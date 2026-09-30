# 🚀 MVP PROTOCOL: THE INSURANCE DASHBOARD (Branch: `feature/insurance-dashboard`)

> **MISSION:** Build the "Command Center" for a single policy.
> **UX GOAL:** "Context Isolation." When I am looking at John's Car, I should see *only* the documents, history, and details for that Car.
> **STYLE:** Papermark (Clean, Tabbed, Data-Dense).

---

## 🟢 STEP 1: THE DATA STRATEGY (Composite Fetching)
**Goal:** The dashboard needs data from 3 sources to render the "Overview".
1.  **The Policy:** (Status, Product Name).
2.  **The Asset:** (RiskItem - Vehicle Reg, Make).
3.  **The Current Reality:** (Latest RiskNote - Dates, Premium).

**Action:** Update `frontend/src/hooks/useInsurance.ts`.
Create a helper hook that aggregates this logic so the UI is clean.
```typescript
export const usePolicyDashboard = (policyId: string) => {
  const policyQuery = usePolicy(policyId);

  // We need the *Latest* Risk Note to show current dates/premium
  const riskNotesQuery = useRiskNotes(policyId);
  const latestRiskNote = riskNotesQuery.data?.sort((a, b) =>
    new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  )[0];

  // We need the *Active* Risk Item to show the vehicle details
  // (In a real app, fetch RiskItems and find the one where is_active=true)
  const riskItemsQuery = useRiskItems(policyId);
  const activeItem = riskItemsQuery.data?.find(item => item.is_active);

  return {
    policy: policyQuery.data,
    latestRiskNote,
    activeItem,
    isLoading: policyQuery.isLoading || riskNotesQuery.isLoading
  };
};
```
🟢 STEP 2: THE UI COMPONENTS (The Atoms)

Goal: Modular components to avoid a 500-line file.
Component A: PolicyHeader.tsx

    Visual: Large Title ("Motor Private"), Status Badge ("Active"), and Breadcrumbs ("Clients / John Doe / P/001/26").

    Actions: "Edit Policy" (Metadata only).

Component B: CoverageCard.tsx (The "Face")

    Source: latestRiskNote.

    Visual: Looks like a mini-certificate.

    Content:

        Period: Jan 1, 2026 → Dec 31, 2026.

        Sum Insured: KES 2,500,000.

        Total Premium: KES 45,000 (Green Text).

    Action: "View Breakdown" (Opens the Invoice Logic from mvp_views.md).

Component C: AssetCard.tsx (The "Thing")

    Source: activeItem (RiskItem).

    Visual: A technical spec sheet.

    Content:

        Reg No: KCA 123B

        Make/Model: Toyota Harrier

        Chassis: JMZ...

        If Property: L.R. Number, Location.

🟢 STEP 3: THE TAB ARCHITECTURE

Goal: Clean organization of complexity.

Layout: routes/_layout/insurance.$policyId.tsx Use Shadcn Tabs.
Tab 1: "Overview" (The Happy Path)

    Layout: 2-Column Grid (grid-cols-3).

    Left (2 cols): CoverageCard + AssetCard stacked.

    Right (1 col): "Quick Actions" Panel.

        [Button] Renew Policy (Triggers Wizard).

        [Button] Endorse / Modify (Triggers Wizard).

        [Button] Print Certificate.

        [Button] Print Debit Note.

Tab 2: "History" (The Audit Trail)

    Layout: Simple <DataTable />.

    Data: Map through riskNotesQuery.data.

    Columns:

        Date (start_date).

        Transaction (New Business, Endorsement).

        Reference (risk_note_number).

        Amount (gross_premium).

        User (Prepared By).

Tab 3: "Documents" (The Vault)

    Data: Filter Documents where entity_id == policyId.

    Visual: List of files with Icons (PDF, IMG).

    Action: "Upload Document" button (top right).

🟢 STEP 4: IMPLEMENTATION ORDER

    Hook: Build usePolicyDashboard first. If data is missing, nothing works.

    Skeleton: Build the Tabs layout with placeholder text.

    Cards: Build CoverageCard and AssetCard.

    Wiring: Connect the Hook data to the Cards.
