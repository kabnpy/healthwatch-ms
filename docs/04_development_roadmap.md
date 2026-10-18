# Development Roadmap & Project Status

## 📌 Current Project Status

### Completed Milestones
- **Upstream Sync (Full Stack Modernization)**:
  - Upgraded backend to Python 3.14.8 with `uv`, FastAPI 0.143+, SQLModel 0.0.48+, Pydantic 2.14+, and Alembic 1.20+.
  - Migrated password hashing from deprecated `passlib` to `pwdlib[argon2,bcrypt]`.
  - Consolidated Alembic baseline migration (`19bab995ff26_initial_schema.py`) with `AUTO_CREATE_TABLES` toggle.
  - Upgraded frontend to React 19, `@tanstack/react-query` v5, `@tanstack/react-router`, Vite 8, and Biome with Bun.
  - Regenerated API client using `@hey-api/openapi-ts` with `@hey-api/client-axios` unwrapping `.data` at domain hook boundaries.
  - Upgraded to Docker Compose v2 specification (`compose.yml`, `compose.override.yml`, `compose.deploy.yml`), Traefik v3.3, and Mailpit.
- **Transactional Snapshot Pattern**:
  - `RiskNote.cover_snapshot` is the single authoritative source of truth for policy cover state.
  - `Policy` serves as the durable identity container without temporal duplicate state.
  - Financial calculations use fixed-point Python `Decimal`.

### Immediate Next Objectives
1. **Audit Traceability & Product Versioning (`audit_hardening`)**:
   - Add product versioning (`version`, `is_active`, `superseded_by_id`) to ensure historical quotes remain intact.
   - Normalize `Client.contacts` from JSON into relational `ClientContact` model.
   - Standardize `AuditMixin` across all core models.
2. **Endorsement Expansion**:
   - Finalize pro-rata endorsement calculations and rating tier logic.
   - Add comprehensive tests for temporal risk modifications.

---

## 🚩 Feature Milestones

### Phase 1: MVP Core (Operational)
- [x] Backend Core Models (Client, Policy, RiskNote, RiskItem).
- [x] Transaction snapshot engine for New Business.
- [x] Prestart migrations and seed data scripting.
- [x] Frontend Client Hub and Policy Dashboard views.
- [x] New Policy Wizard with dynamic duration calculations.
- [x] Risk Note printable layout.

### Phase 2: Temporal Versioning & Endorsements
- [ ] Implement `RiskItem` versioning logic (expire previous version -> issue updated snapshot).
- [ ] Endorsement Wizard for mid-term adjustments (asset, coverage, sum insured).
- [ ] Pro-rata premium delta calculations.
- [ ] Policy history log showing temporal changes across Risk Notes.

### Phase 3: Invoicing & Payments
- [x] Basic Debit Note view and decoupled invoicing.
- [ ] `Receipt` and `Allocation` transaction models.
- [ ] Multi-policy payment reconciliation and split allocations.
- [ ] Statement of accounts for clients and broker commission tracking.

### Phase 4: Claims Management
- [ ] `Claim` and `ClaimEvent` models.
- [ ] Claims registration workflow and notification dispatch.
- [ ] Claims status tracking and settlement ledger.
