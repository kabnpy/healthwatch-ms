---
name: conductor
description: >-
  Autonomous track and feature delivery workflow. Use when designing or implementing
  complex features, multi-step refactors, domain models, or critical business logic
  requiring test-driven development (TDD) and verification quality gates.
---

# Conductor Feature Delivery Workflow

A streamlined, test-driven execution workflow for building features and refactors with high reliability and zero git friction.

---

## 1. Feature Track Lifecycle

Every non-trivial feature or refactor follows four disciplined phases:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. Spec & Plan  │ ──► │     2. TDD       │ ──► │ 3. Quality Gates │ ──► │ 4. Commit & Done │
│  (Tasks & Scope) │     │ (Red ──► Green)  │     │ (Lint, Test, TS) │     │  (Conventional)  │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Phase 1: Specification & Plan
Before modifying code:
1. Identify the user goal and architectural impact against [docs/](file:///home/kabnpy/Projects/healthwatch-ms/docs/).
2. Define clear acceptance criteria.
3. List the sequential implementation steps.

### Phase 2: Test-Driven Development (Red-Green-Refactor)
1. **Red Phase (Write Failing Tests First):**
   - Write targeted unit or integration tests that assert the new behavior.
   - Run tests and confirm they fail:
     ```bash
     uv run pytest backend/tests/test_new_feature.py
     ```
2. **Green Phase (Implement Minimum Code):**
   - Write the cleanest implementation necessary to satisfy the tests.
   - Run tests and verify they pass.
3. **Refactor Phase:**
   - Optimize and clean up while keeping all tests green.

### Phase 3: Quality Gates
Before declaring work complete, ensure all gates pass:
- **Backend Quality:**
  ```bash
  uv run pytest
  uv run ruff check --fix
  uv run ruff format
  ```
- **Frontend Quality (if UI affected):**
  ```bash
  bun run lint
  bun run build
  ```
- **API Client Sync (if endpoints changed):**
  ```bash
  bun run generate-client
  ```

### Phase 4: Verification & Clean Commit
1. **Manual Verification:** Provide concrete verification steps (curl commands or UI URLs) showing the feature working.
2. **Conventional Commit:** Stage related changes and commit with a standard prefix:
   ```bash
   git commit -m "feat(domain): implement product versioning logic"
   ```

---

## 2. Invariant Rules
- **No Git Notes / No Micro-Commits:** Do not attach git notes or make empty checkpoint commits for intermediate steps. Commit when a logical task or phase is complete.
- **Single Source of Truth:** Document architectural decisions in [docs/architecture_decision_records.md](file:///home/kabnpy/Projects/healthwatch-ms/docs/architecture_decision_records.md). Keep track status updated in [docs/04_development_roadmap.md](file:///home/kabnpy/Projects/healthwatch-ms/docs/04_development_roadmap.md).
