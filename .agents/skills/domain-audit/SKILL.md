---
name: domain-audit
description: >-
  Audit a change against HealthWatch MS domain invariants: financial precision,
  UTC timestamps, policy and risk note rules, payment ledger rules, and tone. Use
  when changing rating, premiums, invoices, payments, policies, renewals, or any
  model or schema, and during review.
---

# Domain Invariant Audit

Source of truth: [GEMINI.md](../../../GEMINI.md) and `docs/`. Run this review on
the diff (`git diff main...HEAD`) and report each finding with file and line.

## Checks

### Money
- [ ] No `float` anywhere in premium, tax, levy, commission, or payment code.
      Search the diff for `float(`, `: float`, `float ` and JSON number parsing
      of money on the frontend.
- [ ] `Decimal` values are created from strings or integers, never from floats.
- [ ] Quantization is explicit and fixed-point; rounding mode is stated.
- [ ] The versioned `PremiumCalculation` is the calculation authority. Nothing
      recomputes premiums independently in a route, a component, or a snapshot.

### Time
- [ ] Timestamps are timezone-aware UTC (`get_datetime_utc()`); no naive
      `datetime.now()` or `utcnow()`.

### Policies and risk notes
- [ ] `Policy` stays a durable contract container.
- [ ] A `RiskNote` is generated only for products that need a carrier cover slip
      (Motor, Domestic). Medical never produces one.
- [ ] `RiskNote.cover_snapshot` is immutable once generated.

### Payments
- [ ] `PaymentRecord` is cleared funds only.
- [ ] `PaymentAllocation` is created under a lock and the sum of allocations for
      a payment never exceeds the payment.
- [ ] `proof_of_payment` documents never change invoice balances.
- [ ] Only an `insurer_receipt` document unlocks commission eligibility and
      confirms active status.
- [ ] No general ledger, bank feed, or payment gateway behaviour is introduced.

### Architecture
- [ ] Routes live in `backend/app/api/routes/` and are registered in
      `backend/app/api/main.py`; business logic is in `services/` or `crud/`.
- [ ] Request and response payloads are Pydantic v2 models; sessions via
      `SessionDep`.
- [ ] Frontend data access uses hooks in `frontend/src/hooks/` and unwraps
      `.data` at the hook boundary.

### Language
- [ ] No emoji in code, comments, docs, or UI copy.
- [ ] Agency terminology: HealthWatch MS is an insurance agency; staff are agents
      or account managers.

## Output
List violations first (with file and line), then risks, then confirmations of
what was checked. Do not fix findings unless asked.
