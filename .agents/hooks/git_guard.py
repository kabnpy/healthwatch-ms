#!/usr/bin/env python3
"""PreToolUse guard: keep agents off protected branches and away from unsafe git.

Reads the hook payload on stdin and prints a decision JSON on stdout.

Deny rules (hard block, reason is fed back to the model):
  * write_file / edit_file targeting a repo whose checked-out branch is
    main or master.
  * git commit / merge / push / reset --hard on main or master, unless the
    command is a `./run task:` script.
  * git stash (the stash stack is shared by every worktree).
  * Any command using --no-verify or force-pushing.

Everything else passes through silently (no output, exit 0). Internal errors also
pass through: a bug in this script must not lock the agent out of the repo.
"""

import json
import os
import re
import subprocess
import sys

PROTECTED = {"main", "master"}
FILE_TOOLS = {"write_file", "edit_file"}

START_HINT = "Create an isolated worktree first: ./run task:start <type>/<name>"


def current_branch(directory: str) -> str:
    """Return the checked-out branch for the repo containing directory."""
    while directory and not os.path.isdir(directory):
        parent = os.path.dirname(directory)
        if parent == directory:
            return ""
        directory = parent
    try:
        out = subprocess.run(
            ["git", "-C", directory, "branch", "--show-current"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return out.stdout.strip()


def deny(reason: str) -> dict:
    return {"decision": "deny", "reason": reason}


def check_file_tool(args: dict) -> dict:
    path = args.get("Path") or args.get("TargetFile") or ""
    if not path:
        return {}
    branch = current_branch(os.path.dirname(path))
    if branch in PROTECTED:
        return deny(
            f"Editing files on protected branch '{branch}' is not allowed. {START_HINT}"
        )
    return {}


def split_segments(command: str) -> list[str]:
    return [s.strip() for s in re.split(r"&&|\|\||;|\n|\|", command) if s.strip()]


def check_command(command: str, workspace: str) -> dict:
    if "--no-verify" in command:
        return deny("Skipping git hooks (--no-verify) is not allowed.")
    for segment in split_segments(command):
        if segment.startswith("./run task:"):
            continue
        match = re.match(r"git\s+(?:-C\s+(\S+)\s+)?(\S+)(.*)", segment)
        if not match:
            continue
        directory = match.group(1) or workspace
        verb = match.group(2)
        rest = match.group(3)
        if verb == "stash":
            return deny(
                "git stash is shared across all worktrees and can leak work between "
                "tasks. Commit to your branch or use git restore instead."
            )
        if verb == "push" and re.search(r"--force(?!-with-lease)|\s-f(\s|$)", rest):
            return deny("Force-pushing is not allowed.")
        mutating = verb in {"commit", "merge", "push", "rebase"} or (
            verb == "reset" and "--hard" in rest
        )
        if mutating:
            branch = current_branch(directory)
            if branch in PROTECTED:
                return deny(
                    f"git {verb} on protected branch '{branch}' is not allowed. "
                    f"{START_HINT}. Land work via ./run task:finish."
                )
    return {}


def main() -> None:
    try:
        payload = json.load(sys.stdin)
        tool = payload.get("toolCall", {})
        name = tool.get("name", "")
        args = tool.get("args", {}) or {}
        workspaces = payload.get("workspacePaths") or [os.getcwd()]
        workspace = workspaces[0]
        if name in FILE_TOOLS:
            result = check_file_tool(args)
        elif name == "run_command":
            result = check_command(args.get("CommandLine", ""), workspace)
        else:
            result = {}
    except Exception:  # noqa: BLE001 - fail open on our own bugs
        result = {}
    # Silent pass-through: Antigravity treats an empty stdout as "no opinion" and
    # falls through to the normal permission flow. An empty JSON object is
    # rejected as invalid, and {"decision": "allow"} would override approvals.
    if result:
        print(json.dumps(result))


if __name__ == "__main__":
    main()
