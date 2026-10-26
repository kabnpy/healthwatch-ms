"""Offline tests for the agent hooks. Run with: ./run hooks:test"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))


def run_hook(script: str, payload: dict) -> dict:
    out = subprocess.run(
        [sys.executable, os.path.join(HERE, script)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout) if out.stdout.strip() else {}


def git(repo: str, *args: str) -> None:
    subprocess.run(["git", "-C", repo, *args], check=True, capture_output=True)


def make_repo(branch: str) -> str:
    repo = tempfile.mkdtemp()
    git(repo, "init", "-b", branch)
    git(repo, "config", "user.email", "t@example.com")
    git(repo, "config", "user.name", "t")
    git(repo, "commit", "--allow-empty", "-m", "chore: init")
    return repo


def cmd(repo: str, line: str) -> dict:
    return {
        "toolCall": {"name": "run_command", "args": {"CommandLine": line}},
        "workspacePaths": [repo],
    }


class GitGuardTests(unittest.TestCase):
    def test_edit_on_main_denied(self) -> None:
        repo = make_repo("main")
        payload = {
            "toolCall": {"name": "edit_file", "args": {"Path": f"{repo}/a.txt"}},
            "workspacePaths": [repo],
        }
        self.assertEqual(run_hook("git_guard.py", payload)["decision"], "deny")

    def test_edit_on_feature_branch_allowed(self) -> None:
        repo = make_repo("feat/x")
        payload = {
            "toolCall": {"name": "write_file", "args": {"Path": f"{repo}/a.txt"}},
            "workspacePaths": [repo],
        }
        self.assertEqual(run_hook("git_guard.py", payload), {})

    def test_edit_outside_repo_allowed(self) -> None:
        payload = {
            "toolCall": {"name": "write_file", "args": {"Path": "/tmp/x/y.md"}},
            "workspacePaths": ["/tmp"],
        }
        self.assertEqual(run_hook("git_guard.py", payload), {})

    def test_commit_on_main_denied(self) -> None:
        repo = make_repo("main")
        self.assertEqual(
            run_hook("git_guard.py", cmd(repo, "git add -A && git commit -m x"))[
                "decision"
            ],
            "deny",
        )

    def test_commit_on_feature_allowed(self) -> None:
        repo = make_repo("feat/x")
        self.assertEqual(run_hook("git_guard.py", cmd(repo, "git commit -m x")), {})

    def test_stash_denied(self) -> None:
        repo = make_repo("feat/x")
        self.assertEqual(
            run_hook("git_guard.py", cmd(repo, "git stash"))["decision"], "deny"
        )

    def test_no_verify_denied(self) -> None:
        repo = make_repo("feat/x")
        result = run_hook("git_guard.py", cmd(repo, "git commit --no-verify -m x"))
        self.assertEqual(result["decision"], "deny")

    def test_force_push_denied_but_lease_allowed(self) -> None:
        repo = make_repo("feat/x")
        self.assertEqual(
            run_hook("git_guard.py", cmd(repo, "git push --force origin x"))[
                "decision"
            ],
            "deny",
        )
        self.assertEqual(
            run_hook("git_guard.py", cmd(repo, "git push --force-with-lease")), {}
        )

    def test_task_scripts_allowed_on_main(self) -> None:
        repo = make_repo("main")
        self.assertEqual(
            run_hook("git_guard.py", cmd(repo, "./run task:finish feat/x")), {}
        )

    def test_malformed_input_fails_open(self) -> None:
        out = subprocess.run(
            [sys.executable, os.path.join(HERE, "git_guard.py")],
            input="not json",
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(out.stdout.strip(), "")

    def test_passthrough_prints_nothing(self) -> None:
        repo = make_repo("feat/x")
        out = subprocess.run(
            [sys.executable, os.path.join(HERE, "git_guard.py")],
            input=json.dumps(cmd(repo, "git status")),
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(out.stdout.strip(), "")


class StopGateTests(unittest.TestCase):
    def payload(self, repo: str, attempt: int = 1) -> dict:
        return {
            "terminationReason": "NO_TOOL_CALL",
            "executionNum": attempt,
            "workspacePaths": [repo],
        }

    def test_clean_tree_stops(self) -> None:
        repo = make_repo("feat/x")
        self.assertEqual(run_hook("stop_gate.py", self.payload(repo))["decision"], "stop")

    def test_dirty_tree_continues(self) -> None:
        repo = make_repo("feat/x")
        with open(os.path.join(repo, "new.txt"), "w", encoding="utf-8") as fh:
            fh.write("x")
        self.assertEqual(
            run_hook("stop_gate.py", self.payload(repo))["decision"], "continue"
        )

    def test_gate_releases_after_two_attempts(self) -> None:
        repo = make_repo("feat/x")
        with open(os.path.join(repo, "new.txt"), "w", encoding="utf-8") as fh:
            fh.write("x")
        self.assertEqual(
            run_hook("stop_gate.py", self.payload(repo, attempt=3))["decision"],
            "stop",
        )


if __name__ == "__main__":
    unittest.main()
