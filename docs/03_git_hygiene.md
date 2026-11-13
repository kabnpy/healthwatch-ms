# Git & Commit Hygiene Guide

Version control, branching, and commit standards for the HealthWatch MS workspace.

---

## 1. Conventional Commits Standard

Every commit message must follow the Conventional Commits specification (enforced via `scripts/check_commit_msg.py`):

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
| `docs` | Documentation changes only | `docs: update product specs and ADRs` |
| `chore` | Build tools, dependency bumps, or dev scripts | `chore(ci): update uv to v0.9 and python to 3.14` |
| `ci` | CI/CD workflow changes | `ci(github): add commit-msg lint check to PR workflow` |
| `perf` | Performance optimizations | `perf(db): add index on risknote policy_id and created_at` |

### Rules & Formatting
- **Subject line:** Use imperative mood, lowercase first letter after colon, no trailing period.
- **Atomic Commits:** Each commit represents one cohesive, testable slice. Run `bun run lint` and `bun run typecheck` before committing.

---

## 2. Environment & Secret Protection

- Real environment files (`.env`, `frontend/.env`, `*.local`) are **never tracked in git**.
- Document any new environment variables in `.env.example` with sanitized placeholder values.

---

## 3. Branching & Spec Implementation Workflow

### Branch Naming Conventions
- `feat/<feature-name>` (e.g., `feat/document-renderer`)
- `fix/<bug-description>` (e.g., `fix/invoice-numbering`)
- `refactor/<module-name>` (e.g., `refactor/document-templates`)
- `chore/<task-name>` (e.g., `chore/agent-setup`)

### Single-Ticket vs. Multi-Ticket Spec Execution
- **Single ticket (`/implement` or `/ticket-learning-workflow`):** Work on a feature branch off `main`, driving red-green slices via `/tdd` and finishing with `/code-review`.
- **Multi-ticket spec (`/implement-spec`):** Create one integration branch (`feat/<spec-name>`), dispatch implementer subagents in isolated branch workspaces (`Workspace: "branch"`), merge completed ticket branches into the integration branch, delete temporary `subagent-*` branches, and run `/code-review` across the integration branch before squash-merging to `main`.
- **Shared Resources Across Worktrees:** PostgreSQL (5432), FastAPI (8000), Vite (5173), and `frontend/openapi.json` (`bun run client`) must not be mutated concurrently by parallel tasks; run `bun run client` in a serialized step or on the integration branch.

---

## 4. Pre-Commit Shims (`prek`)

Git hook shims are managed via `prek` (`.pre-commit-config.yaml`):
- **Pre-commit checks:** Runs Ruff (`ruff check`, `ruff format`), Biome (`biome check`), YAML/TOML validators, and whitespace fixers.
- **Commit-msg check:** Runs `scripts/check_commit_msg.py` on every commit.

```bash
# Reinstall git hooks
backend/.venv/bin/prek install -t pre-commit -t commit-msg

# Run pre-commit checks manually across all files
backend/.venv/bin/prek run -a
```
