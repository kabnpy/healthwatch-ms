# 🚀 MVP PROTOCOL: NEW BUSINESS WIZARD (Branch: `feature/new-business-wizard`)

> **MISSION:** Build the primary data entry point for the system.
> **COMPLEXITY:** High. It combines Data Entry, Real-time Math, and JSON Construction.
> **UX PATTERN:** "Stepper Modal" (Asset -> Financials -> Review).



---

## 🟢 STEP 1: THE DATA STRUCTURE (Frontend State)
**Goal:** Define the "Session State" that exists before we save to the DB.

**Action:** Create `types/wizard.ts`.

```typescript
// The "Draft" State
export interface WizardState {
  // Step 1: The Asset
  asset: {
    identifier: string;       // "KCA 123B"
    makeModel: string;        // "Toyota Harrier"
    details: Record<string, any>; // { chassis: "...", engine: "..." }
  };

  // Step 2: The Money & Coverage
  financials: {
    sumInsured: number;       // The base for all math
    rate: number;             // e.g. 4.5%
    startDate: Date;
    duration: number;         // Months (usually 12)
  };

  // Step 2b: The Toggles (Extensions)
  extensions: {
    pvt: boolean;             // Political Violence
    excessProtector: boolean;
    passengerLiability: boolean;
  };

  // Step 2c: The Promises (Custom Benefits)
  // These default to Product Standards, but can be overridden
  benefitOverrides: {
    towingLimit?: number;     // e.g. User types 50000 (Standard is 30000)
    windscreenLimit?: number;
    radioLimit?: number;
  };
}
```
🟢 STEP 2: THE CALCULATOR LOGIC (The Brain)

Goal: A pure function that takes the State and returns the Invoice Math. Location: src/lib/calculator.ts

Logic Requirements:

    Base: Sum Insured * (Rate / 100)

    Extensions:

        PVT = 0.25% of Sum Insured.

        Excess Protector = 0.25% of Sum Insured.

    Levies (The "Government's Cut"):

        Training Levy = 0.2% of Base.

        PHCF = 0.25% of Base.

        Stamp Duty = Fixed 40 KES.

    Output: A clean JSON object matching the premium_breakdown DB field.

🟢 STEP 3: THE UI COMPONENTS (The Stepper)

Location: components/insurance/wizard/
3.1 Step 1: Asset Details

    Focus: Speed.

    Fields:

        Registration No (Uppercase force).

        Make & Model (Text).

        Nice to have: "Copy from previous policy" button (Future).

3.2 Step 2: Cover & Financials (The Complex Part)

    Layout: 2-Column Grid.

    Left Column (Inputs):

        Input: Sum Insured.

        Input: Rate % (Default: 4.5).

        Toggles: Switch components for "Include PVT", "Include Excess Protector".

        Accordion: "Customize Benefits".

            Inside: Inputs for "Towing Limit", "Windscreen".

            UX: Show the default value as placeholder.

    Right Column (Live Preview):

        Sticky Sidebar.

        Shows the calculatePremium(state) result instantly.

        Total Premium displayed in large Green Text.

3.3 Step 3: Review & Commit

    Goal: Catch typos.

    Display: A summary table of what is about to be saved.

    Action: "Issue Policy" Button.

🟢 STEP 4: THE SUBMISSION (The Mutation)

Goal: Transform the Wizard State into Backend Payloads.

Action: handleSubmit() logic.

    Create RiskItem Payload:

        identifier = state.asset.identifier

        valid_from = state.financials.startDate

        version_number = 1

    Create RiskNote Payload:

        transaction_type = "New Business"

        premium_breakdown = calculatePremium(state) (The Full JSON)

        benefits_snapshot = merge(ProductDefaults, state.benefitOverrides) (The Promises)

        risk_item_snapshot = state.asset (The Asset at this moment)

    Execute: Call useCreatePolicy (or useCreateRiskNote if Policy exists).

🟢 IMPLEMENTATION CHECKLIST

    [ ] Calculator: Write src/lib/calculator.ts first. Test it with console logs.

    [ ] State: Create the WizardState interface.

    [ ] UI Shell: Build the Modal with the 1-2-3 progress bar.

    [ ] Step 2: Build the Form + Live Sidebar integration.

    [ ] Wiring: Connect the "Issue Policy" button to the API.

    ## 🟢 STEP 5: SCALABILITY (The "Universal" Modes)

    **Goal:** Reuse this UI for Renewals and Endorsements.

    **Implementation:**
    The `<NewBusinessWizard />` should accept a `mode` prop.

    ```typescript
    type WizardMode = "NEW" | "RENEWAL" | "ENDORSEMENT";

    interface WizardProps {
      mode: WizardMode;
      initialData?: WizardState; // Pass existing policy data here
      onComplete: (payload: any) => void;
    }
