---
status: accepted
---

# Policy Container Identity and Transactional Snapshots

`Policy` is strictly a durable contract container (`policy_number`, `client_id`, `product_id`, `inception_date`, `status`) rather than a mutable table of temporal coverage columns or parallel `RiskItem` rows. Pricing authority resides exclusively in the versioned `PremiumCalculation`, and a `RiskNote` (`cover_snapshot`) is generated only as an immutable transaction overview for product lines that require carrier cover slips (such as Motor or Domestic) on new business, renewals, or endorsements—never for Medical policies or cancellations.
