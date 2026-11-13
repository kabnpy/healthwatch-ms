---
status: accepted
---

# Unified DocumentRenderer, Async Document Jobs, and Request-Time Snapshots

All HTML previews and PDF exports (`RiskNote`, `Invoice`, `Statement`, `PolicySchedule`) are produced through a single server-side `DocumentRenderer` returning an immutable `RenderedDocument` built with semantic HTML `<table>` layouts for A4 print fidelity. Asynchronous PDF generation endpoints return `202 Accepted` with a durable `DocumentJob` (`Idempotency-Key` scoped) and freeze the generation input snapshot at request time in the same database transaction before enqueueing, except `Statement` which creates its database row only after rendering succeeds.
