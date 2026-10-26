---
name: verify
description: >-
  Evidence-based completion gate. Use before telling the user a task is done, before
  committing a feature or fix, and when delegating independent verification to a
  subagent. Requires running lint, tests, and (for UI changes) the e2e suite and
  showing the output.
---

# Verify Before Claiming Done

A task is not done because the code looks right. It is done when the checks below
have been run in the task worktree and their output has been read.

## 1. Preconditions
- You are inside a task worktree (`.worktrees/<type>-<name>`), not on `main`.
- `git status` shows only changes that belong to this task.

## 2. Gates (run from the worktree root)
Run only what the change touches, but never skip a gate that applies.

| Change touches | Command |
| :--- | :--- |
| Any backend file | `./run test:backend` |
| Any frontend file | `./run test:frontend` and `cd frontend && bun x tsc -p tsconfig.build.json` |
| Any file | `./run lint` (then confirm `git status` shows no unexpected diffs) |
| Backend schemas or routes | Regenerate the client (see the `client-regen` skill) and rebuild the frontend |
| Models or migrations | Follow the `db-migration` skill, including the downgrade test |
| UI behaviour | The `qa-journey` skill against the running stack |
| Money, taxes, invoices, payments | The `domain-audit` skill |

## 3. Report format
Finish with a short table: gate, command, result (pass or fail with the failing
test names). Never write "should pass" or "looks good". If a gate could not be
run, say which one and why. If something fails, fix it or report it; do not
weaken or delete a test to make it pass.

## 4. Independent verification
For non-trivial changes, delegate to a read-only verifier subagent so the builder
does not grade its own work. Use the prompt in
[references/verifier-prompt.md](references/verifier-prompt.md) and give it the
worktree path, the branch, and a one-paragraph description of the intended
behaviour. Act on every blocker it reports before declaring completion.

## 5. Then commit
Commit atomically with a Conventional Commit message from inside the worktree
(`git add`, `git commit`, using `BypassSandbox: true`). Do not use `--no-verify`.
