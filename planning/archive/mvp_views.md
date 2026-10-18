# 🚀 MVP PROTOCOL: VIEWS & COMPLEX DATA (Branch: `feature/complex-views`)

> **MISSION:** Upgrade the Risk Note from "Simple Placeholder" to "Real Insurance Document".
> **FOCUS:** Handling PVT, Excess Waivers, and Generating the Invoice View.

---

## 🟢 STEP 1: BACKEND DATA MODELING
**Goal:** Enable the Risk Note to store complex, variable data.
**Action:** Update `RiskNote` in `backend/app/models.py`.

1.  **Remove:** `basic_premium`, `gross_premium` (Too simple).
2.  **Add JSON Fields:**
    ```python
    class RiskNote(SQLModel, table=True):
        # ... existing fields ...

        # 1. The Financials (The Invoice)
        # Stores: { "basic": 45000, "pvt": 1125, "levies": [...], "total": 47000 }
        premium_breakdown: Dict = Field(default={}, sa_column=Column(JSON))

        # 2. The Promises (The Certificate)
        # Stores: { "towing": 100000, "windscreen": 50000 } - Can differ from Product defaults
        benefits_snapshot: Dict = Field(default={}, sa_column=Column(JSON))

        # 3. The Asset Snapshot
        # Stores: "Toyota Harrier, KCA 123B" (So we know what was covered even if RiskItem changes)
        risk_item_snapshot: Dict = Field(default={}, sa_column=Column(JSON))
    ```
3.  **Migration:** Since we are in dev/MVP, just drop the table or `alembic revision --autogenerate`.

---

## 🟢 STEP 2: THE "CALCULATOR" ENGINE
**Goal:** We need logic that takes "Sum Insured + Toggles" and spits out the breakdown.
**Strategy:** Keep it in the Frontend for the MVP (for speed), or Backend endpoint (cleaner).
**Decision:** **Frontend Utility Function** (Fastest for Friday).

**Action:** Create `frontend/src/lib/calculator.ts`
```typescript
interface CalculationInput {
  sumInsured: number;
  rate: number; // e.g., 4.5%
  hasPVT: boolean;
  hasExcessProtector: boolean;
}

export function calculatePremium(input: CalculationInput) {
  const basic = input.sumInsured * (input.rate / 100);

  // Extensions
  const extensions = [];
  if (input.hasPVT) extensions.push({ name: "PVT", amount: basic * 0.0025 });
  if (input.hasExcessProtector) extensions.push({ name: "Excess Protector", amount: basic * 0.0025 });

  const extensionsTotal = extensions.reduce((acc, curr) => acc + curr.amount, 0);

  // Levies (Standard Kenyan Insurance Taxes)
  const trainingLevy = basic * 0.002; // 0.2%
  const phcf = basic * 0.0025;        // 0.25%
  const stampDuty = 40;               // Fixed

  const total = basic + extensionsTotal + trainingLevy + phcf + stampDuty;

  return {
    breakdown: { basic, extensions, levies: { trainingLevy, phcf, stampDuty }, total }
  };
}
```
🟢 STEP 3: THE "NEW BUSINESS" WIZARD (The UI)

Goal: A UI that lets us toggle these extras. File: components/insurance/RiskNoteWizard.tsx (The Modal).

    Inputs:

        Sum Insured (Number).

        Rate (Number, defaults to Product rate).

        Toggles (Switch): "Include PVT?", "Include Excess Waiver?".

        Custom Benefits (Accordion): "Edit Limits" (allows overriding Towing/Windscreen).

    Live Preview: Shows the calculatePremium result in real-time as you toggle.

    Save: Sends the entire breakdown to the Backend RiskNote.premium_breakdown.

🟢 STEP 4: THE DUAL-MODE PRINT VIEW

Goal: Solve the "Where is the Invoice?" question. Strategy: One Route, Two Modes.

Route: /print/risk-notes/$id?mode=certificate|invoice
Mode A: The Certificate (?mode=certificate)

    Focus: The Promise.

    Header: "CERTIFICATE OF INSURANCE".

    Body:

        "This is to certify that John Doe is insured..."

        Schedule of Benefits: (Renders riskNote.benefits_snapshot).

        Clauses: "Political Violence Included", "Excess Protector Included".

    Financials: Hides the tax breakdown. Shows only "Total Premium Paid".

Mode B: The Invoice (?mode=invoice)

    Focus: The Math.

    Header: "DEBIT NOTE" (or TAX INVOICE).

    Body:

        Financial Breakdown Table: (Renders riskNote.premium_breakdown).

            Basic Premium: 45,000

            (+) PVT: 1,125

            (+) Training Levy: 100

            TOTAL DUE: 47,390

    Footer: Bank Details & "Prepared By".

🟢 STEP 5: THE DASHBOARD INTEGRATION

Goal: Access these prints.

Action: Update InsuranceDashboard.tsx (Overview Tab).

    The "Face": Display the Total Premium big and bold.

    The "Actions":

        Button: "Print Certificate" (Opens ?mode=certificate).

        Button: "Print Debit Note" (Opens ?mode=invoice).
