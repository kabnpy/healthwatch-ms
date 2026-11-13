---
status: accepted
---

# Versioned Deterministic Rating Engine

All premium and statutory levy calculations run through a deterministic rating engine evaluated against immutable, published `RateTableVersion` schedules using Python fixed-point `Decimal` arithmetic (`ROUND_HALF_UP`). Rather than interpolating or silently falling back when an input falls outside configured rate brackets (`[min_value, max_value)`), the engine halts with an explicit validation error so agents cannot issue quotes from ambiguous or unapproved rates.
