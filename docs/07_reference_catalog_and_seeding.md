# Reference Catalog & Realistic Seed Portfolio

> **STATUS:** Authoritative Reference Catalog & Acceptance Dataset Specification
> **ALIGNMENT:** Synchronized with the Insurance Act (Cap 487), IRA Kenya Underwriter Registry, and [docs/01_product_specs.md](./01_product_specs.md).

---

## 1. Regulatory Context & Market Baseline

In insurance agency operations, seed and acceptance test data must not be arbitrary placeholder text. It represents the regulatory framework and published commercial offerings of the Kenyan insurance market.

HealthWatch MS structures its reference data around public guidelines issued by the **Insurance Regulatory Authority (IRA)** and statutory tax legislation:

### 1.1 Statutory Levies and Tax Invariants
All premium calculations, invoice line items, and payment ledgers must strictly enforce the following statutory rules using Python fixed-point arithmetic (`Decimal`):
- **Insurance Training Levy:** 0.20% ($0.002$) of gross premium (Section 8A, Insurance Act).
- **Policyholders Compensation Fund (PCF) Levy:** 0.25% ($0.0025$) of gross premium.
- **Stamp Duty:** KES 40.00 flat charge per formal policy/contract slip.
  - *Statutory Exemption:* Healthcare / Medical insurance policies are exempt from stamp duty.
- **Financial Arithmetic:** Zero float usage across models and services. Fixed-point rounding (`ROUND_HALF_UP`) to two decimal places.

### 1.2 Public Identifier Formats
- **Kenya Revenue Authority (KRA) PINs:**
  - *Individual PINs:* Letter `A` followed by 9 numerical digits and a trailing checksum letter (e.g., `A001158997L`, `A002849120K`).
  - *Corporate / Non-Individual PINs:* Letter `P` followed by 9 numerical digits and a trailing letter (e.g., `P051289412M`, `P052891024K`).
- **NTSA Motor Vehicle Registration:**
  - Standard national registration sequence (e.g., `KDA 410M`, `KDB 892P`, `KDC 520Q`, `KDD 109K`, `KDE 770B`, `KDF 001M`).
- **Financial Rails & Payment Instruments:**
  - *Safaricom M-Pesa:* 10-character alphanumeric transaction confirmation codes (e.g., `RKA91H2K8M`, `SBE482L9QP`).
  - *Bank RTGS / EFT:* Bank clearing reference numbers (e.g., `NCBA/RTGS/2025/90124`, `KCB/EFT/2025/11024`).
  - *Insurance Premium Financing (IPF):* Tripartite bank facility references (e.g., `STANBIC-IPF-2025-089`).

---

## 2. Licensed Underwriters & Product Catalog

The system catalog seeds 8 major underwriters licensed by the IRA and their flagship product lines across five distinct insurance classes:

| Underwriter | Product Name | Class of Insurance | Pricing Model & Benchmark Rates |
| :--- | :--- | :--- | :--- |
| **Old Mutual General Insurance Kenya Ltd.** | Motor Private - Comprehensive | Motor Private | FixedTiered (3.25%–5.00%, min KES 60,000). High-end threshold: KES 3,000,000. Extensions: PVT (0.25%), Excess Protector (0.25%), OM Rescue Plus (KES 1,000). |
| **Old Mutual General Insurance Kenya Ltd.** | Motor Private - Third Party Only (TPO) | Motor Third Party | FixedTiered flat statutory tariff: KES 7,500/year. Third-party property damage limit KES 3,000,000; bodily injury/death unlimited. |
| **Old Mutual General Insurance Kenya Ltd.** | Commercial Own Goods Comprehensive | Motor Commercial | Percentage (4.50%, min KES 50,000). Speed governor warranty and carriage of own goods only. |
| **Old Mutual General Insurance Kenya Ltd.** | Commercial Vehicle Third Party Only | Motor Commercial Third Party | FixedTiered flat statutory tariff: Own Goods (KES 12,500/year). Third-party property damage limit KES 5,000,000. |
| **Old Mutual General Insurance Kenya Ltd.** | Domestic Package (Homeowners) | Domestic Package | Multi-component percentage: Buildings (0.12%), Contents (0.85%), All Risks (1.75%), Domestic Servants (KES 1,200/servant). |

| **Old Mutual General Insurance Kenya Ltd.** | Afya Imara Family Health | Medical | FixedTiered demographic census: Inpatient limits KES 1M, 2M, 5M across family brackets (M, M+1, M+2, M+3, M+4). Direct carrier terms; **no Risk Notes**. |
| **Jubilee General Insurance Ltd.** | Motor Private - Supreme Cover | Motor Private | FixedTiered (3.25%–5.00%, min KES 65,000). Complimentary AA rescue in Nairobi and Mombasa. |
| **Jubilee General Insurance Ltd.** | Cover All - Homeowners & Tenants | Domestic Package | Multi-component percentage: Buildings (0.10%), Contents (0.75%), All Risks (1.50%), Servants (KES 1,000/servant). |
| **Jubilee General Insurance Ltd.** | J-Care Individual & Family Medical | Medical | FixedTiered demographic census: Inpatient limits KES 500K, 1M, 2M, 5M, 10M. Direct carrier terms; **no Risk Notes**. |
| **Jubilee General Insurance Ltd.** | WIBA / Employers Liability | WIBA | Percentage on declared annual payroll: Clerical (0.50%), Artisan (1.25%), Hazardous (2.50%). Minimum premium KES 25,000. |
| **Britam General Insurance (Kenya) Ltd.** | Motor Private - Comprehensive Elite | Motor Private | FixedTiered (3.25%–4.75%, min KES 55,000). Complimentary road rescue and courtesy car option. |
| **Britam General Insurance (Kenya) Ltd.** | Super Homeowner Package | Domestic Package | Multi-component percentage: Buildings (0.12%), Contents (0.80%), All Risks (1.60%), Servants (KES 1,100/servant). |
| **Britam General Insurance (Kenya) Ltd.** | Milele Health Family Plan | Medical | FixedTiered demographic census: Inpatient limits KES 1M, 2M, 5M, 10M with guaranteed lifetime renewal. **No Risk Notes**. |
| **CIC General Insurance Ltd.** | Motor Private - Prestige Cover | Motor Private | FixedTiered (3.25%–4.85%, min KES 50,000). Windscreen limit KES 40,000, Radio KES 25,000. |
| **CIC General Insurance Ltd.** | Business Combined & Fire | Fire & Perils | Percentage on declared sums insured: Buildings (0.15%), Plant & Machinery (0.20%), Stock (0.25%). |
| **APA Insurance Ltd.** | Motor Private - Drive Sure | Motor Private | FixedTiered (3.25%–5.00%, min KES 55,000). Medical expenses limit KES 30,000 per occupant. |
| **APA Insurance Ltd.** | Jamii Plus Family Medical | Medical | FixedTiered demographic census: Inpatient limits KES 1M, 2M, 5M. **No Risk Notes**. |
| **ICEA LION General Insurance Ltd.** | Motor Private - Executive Cover | Motor Private | FixedTiered (3.00%–4.50%, min KES 70,000). Windscreen KES 100,000, authorized dealer repair clause for vehicles under 5 years. |
| **Britam General Insurance (Kenya) Ltd.** | Corporate Professional Indemnity | Professional Indemnity | Percentage on declared Limit of Indemnity: KES 10M (0.75%), KES 20M (0.60%), KES 50M (0.50%). Minimum premium KES 45,000. |
| **Britam General Insurance (Kenya) Ltd.** | Golfers Comprehensive Package | Golfers | FixedTiered package: Equipment (KES 150,000), Third-Party Liability (KES 1,000,000), Personal Accident (KES 500,000), Hole-in-One (KES 35,000). Flat KES 7,500/year. |
| **Old Mutual General Insurance Kenya Ltd.** | Commercial Public Liability | Public Liability | Percentage on Limit of Indemnity (0.25% - 0.40%) based on business hazard. Minimum premium KES 20,000. |
| **Old Mutual General Insurance Kenya Ltd.** | Individual Personal Accident (PA) | Personal Accident | FixedTiered benefit package by occupation: Class 1 Clerical (KES 6,500), Class 2 Supervisory (KES 9,500), Class 3 Manual (KES 14,000). |
| **CIC General Insurance Ltd.** | Commercial Burglary & Theft | Burglary | Percentage on declared commercial stock/fixtures (0.75%, min KES 10,000). Requires forcible and violent entry clause. |
| **Jubilee General Insurance Ltd.** | Standalone All Risks Protection | All Risks | Percentage on declared portable electronics/valuables schedule (1.75%, min KES 5,000). Geographical scope: Worldwide. |



---

## 3. Standard Acceptance Portfolio Archetypes

The seed dataset contains 28 realistic Kenyan client entities divided into five distinct operational cohorts:

### 3.1 Retail Professionals & Individual Drivers (15 Clients)
- **Profiles:** Doctors, advocates, software engineers, quantity surveyors, architects, and corporate executives resident in Nairobi (Kilimani, Kileleshwa, Westlands, Riverside, Karen, South C), Mombasa (Nyali), Nakuru, and Eldoret.
- **Coverage:** Motor Private Comprehensive policies with vehicle values between KES 1,750,000 and KES 3,800,000.
- **Key Scenarios:** Inception risk notes, certified valuation endorsements, M-Pesa receipts, and policy renewal cycles.

### 3.2 Multi-Policy Family Portfolios (4 Clients)
- **Profiles:** Family heads holding bundled policies across underwriters (e.g., Dr. David Kiptoo holding Jubilee Motor Private and Jubilee J-Care Family Medical; Grace Wanjiku Kariuki holding Britam Motor and Britam Domestic Package).
- **Key Scenarios:** Partial payment allocations, decoupled invoicing, and dual-policy portfolio summaries.

### 3.3 High-Net-Worth (HNW) Households (4 Clients)
- **Profiles:** Executive households (e.g., Ambassador Michael K. Mutiso in Karen, Hon. Catherine Wangari Ndegwa in Runda, Ramesh Harilal Shah in Muthaiga).
- **Assets:** Multi-vehicle motor policies (Toyota Land Cruiser 300 ZX valued at KES 11.5M, Mercedes-Benz E300 AMG valued at KES 6.5M) and luxury Domestic Packages (KES 45M buildings, KES 12M contents, KES 3.5M all-risks valuables).
- **Financial Scenario:** Consolidated RTGS payment (KES 586,000) split across two separate motor invoices under a single payment allocation lock.

### 3.4 Commercial Fleets & Transport SMEs (3 Clients)
- **Profiles:** Transport and logistics operators (e.g., Rift Valley Hauliers Ltd. in Nakuru, Savanna Safari Tours & Travel Ltd. in Nairobi).
- **Assets:** Fleets of Isuzu FRR/FVR commercial trucks and customized 4x4 safari vans.
- **Financial Scenario:** Bank Insurance Premium Financing (IPF) facility disbursed directly by Stanbic Bank (KES 495,000) allocated across multiple commercial vehicle invoices.

### 3.5 Corporate Commercial & Group Accounts (2 Clients)
- **Profiles:** Industrial and trading enterprises (e.g., Blue Nile Trading & Distribution Ltd. in Industrial Area Nairobi).
- **Coverage:** Commercial Fire & Perils covering industrial buildings, machinery, and warehouse stock (KES 90,000,000 total declared sum insured), and statutory WIBA / Employers Liability for operational workforces.

---

## 4. Operational Lifecycle & Renewal Pipeline Distribution

To thoroughly validate the **Renewals Desk** and the **Broker Command Deck**, renewals are seeded across all 6 business workflow states:

```
┌────────────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│  awaiting_carrier  │ ──► │   carrier_received  │ ──► │   client_invited   │
│  (Dr. Kiptoo Auto) │     │  (Dr. Amina Health) │     │ (Grace Kariuki C200)│
└────────────────────┘     └─────────────────────┘     └─────────┬──────────┘
                                                                 │
                                                       (Negotiating terms)
                                                                 ▼
                                                       ┌────────────────────┐
                                                       │ changes_requested  │
                                                       │(Amb. Mutiso LC300) │
                                                       └─────────┬──────────┘
                                                                 │ (Re-agreed)
                                                                 ▼
┌────────────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│     completed      │ ◄── │        paid         │ ◄───┤   client_invited   │
│ (Agnes Mwangi Prado│     │ (Kevin Mutua Tiguan)│     └────────────────────┘
└────────────────────┘     └─────────────────────┘
```

1. **`awaiting_carrier`:** Policy `JUB/POL/MOT/2024/09124` (Subaru Outback KDA 410M). Expires in 30 days; awaiting Jubilee renewal notice.
2. **`carrier_received`:** Policy `OM/MED/2024/09841` (Afya Imara Health). Carrier terms schedule received and uploaded, pending broker invitation preparation.
3. **`client_invited`:** Policy `BRT/MOT/2024/004812` (Mercedes C200 KDB 892P). Renewal terms invitation generated and issued to client.
4. **`changes_requested`:** Policy `ICEA/MOT/2024/00091` (Land Cruiser 300 KDF 001M). Client negotiating 5% portfolio discount and anti-theft deductible waiver.
5. **`paid`:** Policy `APA/MOT/2024/007812` (VW Tiguan KDE 770B). Client payment verified via M-Pesa; awaiting underwriter receipt and cover confirmation.
6. **`completed`:** Policy `010/070/1/012473/2017` (Toyota Prado KCM 780L). Successfully finalized and closed for the previous period.

---

## 5. Financial Ledger & Spreadsheet Invariants

HealthWatch MS provides a clean bounded financial ledger designed to feed agency reconciliation spreadsheets without calculation drift:

1. **`PaymentRecord`:** Represents verified cleared funds in the agency's bank account or paybill.
   - Example 1: Safaricom M-Pesa `RKA91H2K8M` (KES 158,000.00).
   - Example 2: NCBA RTGS `NCBA/RTGS/2025/90124` (KES 586,000.00).
   - Example 3: Stanbic IPF `STANBIC-IPF-2025-089` (KES 495,000.00).
2. **`PaymentAllocation`:** Records the application of cleared funds against an invoice under lock ($\sum \text{allocations} \le \text{payment.amount}$).
   - *Full Settlement:* Payment `RKA91H2K8M` (KES 158,000.00) allocated 100% to Invoice `INV-2025-0012`. Balance due becomes KES 0.00 (`status = Paid`).
   - *Partial Settlement:* Payment `TDF109K3JA` (KES 40,000.00) allocated to Invoice `INV-2025-0046` (KES 68,000.00). Balance due becomes KES 28,000.00 (`status = Partial`).
   - *Multi-Invoice Split:* Payment `NCBA/RTGS/2025/90124` (KES 586,000.00) split across Invoice `INV-2025-0120` (KES 374,000.00) and Invoice `INV-2025-0121` (KES 212,000.00).

---

## 6. Execution & Verification Runbook

### 6.1 Execution
The seed dataset is fully idempotent and can be safely re-run without duplicate key violations:

```bash
# Via master initial data workflow
python -m app.initial_data

# Or directly via seed script
python -m app.seed_mock_data
```

### 6.2 Automated Quality Verification
The automated test suite verifies dataset integrity, relational consistency, and architectural invariants against an in-memory test database:

```bash
pytest tests/test_seed_data.py -v
```

Verification assertions include:
- Invariant: Medical policies have zero Risk Notes.
- Invariant: Motor and Domestic policies have issued Risk Notes.
- Invariant: Payment allocations sum $\le$ PaymentRecord amount.
- Invariant: Zero float usage across financial models.
- Idempotency: Consecutive executions do not duplicate records or mutate existing primary keys.
