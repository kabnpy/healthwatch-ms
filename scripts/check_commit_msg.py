#!/usr/bin/env python3
"""Validates that commit messages comply with the Conventional Commits specification.

Usage:
    python3 scripts/check_commit_msg.py <commit_msg_file>
"""

import re
import sys
from pathlib import Path

CONVENTIONAL_PATTERN = re.compile(
    r"^(?P<type>feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)"
    r"(\((?P<scope>[a-zA-Z0-9_\-\./]+)\))?"
    r"!?:\s(?P<subject>.+)$"
)

# Standard git auto-generated prefixes that should bypass linting
BYPASS_PREFIXES = (
    "Merge ",
    "Revert ",
    "fixup! ",
    "squash! ",
    "amend! ",
)


def main() -> int:
    if len(sys.argv) < 2:
        print("[ERROR] Commit message file path argument missing.", file=sys.stderr)
        return 1

    msg_file = Path(sys.argv[1])
    if not msg_file.is_file():
        print(f"[ERROR] Commit message file not found: {msg_file}", file=sys.stderr)
        return 1

    content = msg_file.read_text(encoding="utf-8").strip()
    if not content:
        print("[ERROR] Commit message cannot be empty.", file=sys.stderr)
        return 1

    # Get first line that is not a comment (#)
    first_line = ""
    for line in content.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            first_line = line
            break

    if not first_line:
        print("[ERROR] Commit message has no content.", file=sys.stderr)
        return 1

    if any(first_line.startswith(prefix) for prefix in BYPASS_PREFIXES):
        return 0

    match = CONVENTIONAL_PATTERN.match(first_line)
    if not match:
        print("\n" + "=" * 60, file=sys.stderr)
        print(" [GIT COMMIT HYGIENE VIOLATION]", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print(f'Your commit message:\n  "{first_line}"\n', file=sys.stderr)
        print("does not follow Conventional Commits.", file=sys.stderr)
        print("\nExpected format:", file=sys.stderr)
        print("  <type>(<scope>): <subject>", file=sys.stderr)
        print("  <type>: <subject>", file=sys.stderr)
        print("\nAllowed types:", file=sys.stderr)
        print("  feat     : A new user/business feature", file=sys.stderr)
        print("  fix      : A bug fix", file=sys.stderr)
        print("  refactor : Code change that neither fixes a bug nor adds a feature", file=sys.stderr)
        print("  test     : Adding or fixing tests", file=sys.stderr)
        print("  docs     : Documentation updates", file=sys.stderr)
        print("  chore    : Tooling, dependency, or config changes", file=sys.stderr)
        print("  ci       : CI/CD configuration and scripts", file=sys.stderr)
        print("  perf     : Code change improving performance", file=sys.stderr)
        print("  style    : Formatting / whitespace (not UI style)", file=sys.stderr)
        print("  revert   : Reverting a previous commit", file=sys.stderr)
        print("\nValid examples:", file=sys.stderr)
        print("  feat(backend): add commercial motor rating formula", file=sys.stderr)
        print("  fix(ui): prevent double submission on policy creation", file=sys.stderr)
        print("  docs: update architecture roadmap", file=sys.stderr)
        print("=" * 60 + "\n", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
