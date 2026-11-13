---
status: accepted
---

# Renewal State Machine, Single Active Renewal, and Concurrency

Annual policy renewals follow a 6-state machine (`awaiting_carrier` -> `carrier_received` -> `client_invited` <-> `changes_requested` -> `paid` -> `completed`) guarded by optimistic concurrency control (`version: int` rejecting stale writes with HTTP `409 Conflict`) and a PostgreSQL partial unique index (`WHERE status NOT IN ('completed', 'cancelled')`) enforcing at most one active renewal per `Policy`. Informal communication (calls, emails, notes) is recorded in append-only `Activity` rows that never implicitly mutate workflow state.
