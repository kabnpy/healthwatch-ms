# Git & Commit Hygiene Guide

This guide defines the version control, branching, and commit standards for the HealthWatch MS workspace.

---

## 1. Conventional Commits Standard

Every commit message must follow the Conventional Commits specification:

```text
<type>(<scope>): <subject>

[optional body: explanation of context, rationale, and consequences]
[optional footer: breaking changes, issue references]
```

### Commit Types
| Type | Purpose | Example |
| :--- | :--- | :--- |
| `feat` | New user/business capability | `feat(backend): implement commercial motor rating logic` |
| `fix` | Bug fix | `fix(ui): prevent duplicate invoice row rendering` |
| `refactor` | Code restructuring without feature or bug changes | `refactor(models): align policy terms with Atomic Snapshot pattern` |
| `test` | Adding or updating unit, integration, or e2e tests | `test(rating): add unit test coverage for passenger liability` |
| `docs` | Documentation changes only | `docs: update tech architecture diagrams and specs` |
| `chore` | Build tools, dependency bumps, or dev scripts | `chore(ci): update uv to v0.9 and python to 3.14` |
| `ci` | CI/CD workflow changes | `ci(github): add commit-msg lint check to PR workflow` |
| `perf` | Performance optimizations | `perf(db): add index on risknote policy_id and created_at` |

### Rules & Formatting
- **Subject line:** Use imperative mood, lowercase first letter after colon, no trailing period (e.g., `feat(ui): add policy print button`, not `feat(ui): Added policy print button.`).
- **Atomic Commits:** Each commit should represent one cohesive, testable change. Avoid mixing formatting changes with business logic.
- **No Checkpoint Spam:** Do not make git commits for task checklist increments (e.g. `conductor(plan): Mark task as complete`). Keep planning artifacts uncommitted until the track or feature milestone is reached.

---

## 2. Environment & Secret Protection

- Real environment files (`.env`, `frontend/.env`, `*.local`) are **never tracked in git**.
- When new environment variables are added, immediately document them in `.env.example` and `frontend/.env.example` with sanitized/dummy placeholder values.

---

## 3. Pull Request & Branching Workflow

### Branch Naming Conventions
- `feat/<feature-name>` (e.g., `feat/renewal-workflow`)
- `fix/<bug-description>` (e.g., `fix/invoice-numbering`)
- `refactor/<module-name>` (e.g., `refactor/document-templates`)
- `chore/<task-name>` (e.g., `chore/upstream-template-sync`)

### Merging Strategy
- Always **Squash and Merge** feature PRs into `main`.
- When squashing, edit the commit message to summarize the entire feature cohesively instead of leaving raw draft commits in `main`.
- Automatically delete head branches upon merge.

---

## 4. Local Validation & Pre-Commit Shims

Git hook shims are managed via `prek` / `pre-commit`:
- **Pre-commit checks:** Automatically runs Ruff (`ruff check`, `ruff format`), Biome (`biome check`), YAML/TOML validators, and whitespace fixers.
- **Commit-msg check:** Automatically runs `scripts/check_commit_msg.py` on every commit to reject non-conventional commit messages.

### Hook Commands
```bash
# Reinstall / update git hooks
backend/.venv/bin/prek install -t pre-commit -t commit-msg

# Run pre-commit checks manually across all files
backend/.venv/bin/prek run -a
```
