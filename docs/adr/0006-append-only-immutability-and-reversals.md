---
status: accepted
---

# Append-Only Immutability and Financial Reversals

Published `RateTableVersion` schedules, `PremiumCalculation` runs, issued `Invoice` and `InvoiceBatch` records, committed `PaymentRecord` and `PaymentAllocation` rows, `RenderedDocument` snapshots, and `Activity` logs forbid in-place `PUT` or hard `DELETE` operations. Any post-issuance or post-commitment correction must be recorded as an explicit append-only reversal, credit note, or successor version so historical audit trails and client statements remain reproducible.
