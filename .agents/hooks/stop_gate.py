#!/usr/bin/env python3
"""Stop hook: do not let the agent finish while work is uncommitted.

Checks the primary checkout and every worktree under .worktrees/. If any has
tracked modifications or untracked, non-ignored files, the stop is blocked and
the agent is told to commit. To avoid trapping a session the user wants to end
without committing, the gate only fires for the first two stop attempts.
"""

import json
import os
import subprocess
import sys

MAX_ATTEMPTS = 2


def dirty_files(directory: str) -> list[str]:
    try:
        out = subprocess.run(
            ["git", "-C", directory, "status", "--porcelain"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    return [line for line in out.stdout.splitlines() if line.strip()]


def candidate_dirs(workspace: str) -> list[str]:
    dirs = [workspace]
    wt_root = os.path.join(workspace, ".worktrees")
    if os.path.isdir(wt_root):
        dirs += [
            os.path.join(wt_root, d)
            for d in sorted(os.listdir(wt_root))
            if os.path.isdir(os.path.join(wt_root, d))
        ]
    return dirs


def main() -> None:
    result: dict = {"decision": "stop"}
    try:
        payload = json.load(sys.stdin)
        if (
            payload.get("terminationReason") == "NO_TOOL_CALL"
            and int(payload.get("executionNum", 1)) <= MAX_ATTEMPTS
        ):
            workspace = (payload.get("workspacePaths") or [os.getcwd()])[0]
            report = []
            for directory in candidate_dirs(workspace):
                files = dirty_files(directory)
                if files:
                    shown = "\n".join(f"  {f}" for f in files[:15])
                    report.append(f"{directory}:\n{shown}")
            if report:
                result = {
                    "decision": "continue",
                    "reason": (
                        "Uncommitted changes remain. Run formatting and linting, then "
                        "commit atomically with a Conventional Commit message (git "
                        "commands need BypassSandbox: true), or tell the user why "
                        "the work is intentionally uncommitted.\n" + "\n".join(report)
                    ),
                }
    except Exception:  # noqa: BLE001 - never trap the agent on our own bugs
        result = {"decision": "stop"}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
