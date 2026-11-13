# HealthWatch MS — Agent Navigation

## Agent skills

### Issue tracker

GitHub Issues on `kabnpy/healthwatch-ms` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

### Workflow skills (`~/.gemini/config/skills/`)

When a skill instructs `"Call the Skill tool with <name>"`, read `/home/kabnpy/.gemini/config/skills/<name>/SKILL.md` with `read_file`.
- **Discovery & framing:** `grill-with-docs`, `wayfinder`, `research`, `prototype`, `domain-modeling`, `codebase-design`
- **Specification & slicing:** `to-spec`, `to-tickets`, `triage`
- **Implementation & review:** `implement`, `implement-spec`, `ticket-learning-workflow`, `tdd`, `code-review`, `diagnosing-bugs`, `retro`, `handoff`

## Context pointers

- **Commands & scripts:** Root `package.json` (`bun run test`, `test:backend`, `test:frontend`, `test:e2e`, `typecheck`, `lint`, `format`, `client`, `migrate`, `seed`, `dev`).
- **Coding & review standards:** `CODING_STANDARDS.md` — read during `/code-review` or when touching money, timestamps, policies, risk notes, payments, or API contracts.
- **Product workflows & rating math:** `docs/01_product_specs.md` — reach when working on new business, renewal state transitions, rating paradigms, IPF, commissions, or claims.
- **UI, typography & print layouts:** `docs/02_design_system.md` — reach when building or modifying React UI components, tables, wizards, or A4 print/PDF templates.
- **Git & branch hygiene:** `docs/03_git_hygiene.md` — Conventional Commits and branch discipline.
- **Kenyan market catalog & seed fixtures:** `docs/04_reference_catalog_and_seeding.md` — reach when working on underwriters, product seed data, or acceptance fixtures.
