---
status: accepted
---

# Bounded Payment Ledger and Evidence Separation

HealthWatch MS intentionally avoids implementing a full general ledger, automated bank feeds, or payment-gateway integrations because agency month-end account reconciliation is maintained in external finance spreadsheets. Instead, the system enforces a strict boundary between cleared financial records (`PaymentRecord` and `PaymentAllocation`, where allocations are applied against an `Invoice` under database lock such that $\sum \text{allocations} \le \text{payment.amount}$) and uploaded evidentiary `Document` records (`proof_of_payment`, which never alters invoice balances, and `insurer_receipt`, which confirms carrier remittance and unlocks agency commission recognition).
