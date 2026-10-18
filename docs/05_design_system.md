# Design System Specification: HealthWatch MS

> **DOCUMENT PURPOSE:** This specification replaces vague aesthetic analogies with concrete, enforceable UI/UX standards, component rules, typography hierarchies, and print specifications for the HealthWatch MS insurance workspace.

---

## 1. Product Design Philosophy

HealthWatch MS is an **audit-grade insurance brokerage workspace**. Its primary users (underwriters, brokers, cashiers) work with multi-variable risk schedules, complex financial levies, temporal policy modifications (endorsements), and legal contracts.

### Core Pillars

1. **Audit-Grade Reliability:** UI states must never be ambiguous. Statuses, currency amounts, effective dates, and policy numbers must have unmistakable visual fidelity and strict alignment.
2. **Information Density with Breathing Room:** Dense data (tables, schedules, line items) is balanced by consistent spatial rhythm, avoiding both bloated consumer-app whitespace and cramped legacy spreadsheets.
3. **Context Preservation:** Complex sub-flows (contact management, document uploads, fee breakdowns) use slide-over sheets (`Sheet`) and contextual tabs rather than disorienting full-page redirects or nested modal stacks.
4. **Dual Legal Output:** Web screens are fast, interactive tools; printed documents (Risk Notes, Debit Notes) are formal legal instruments adhering to strict A4 layout rules.

---

## 2. Color & Surface Architecture

HealthWatch MS uses **OKLCH color tokens** in Tailwind CSS v4, calibrated for optical balance across Light and Dark themes.

### 2.1 Surface Tiers

| Tier | Light Mode Token | Dark Mode Token | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas (Level 0)** | `oklch(0.99 0 0)` | `oklch(0.12 0 0)` | Main window background |
| **Card / Surface (Level 1)** | `oklch(1.0 0 0)` | `oklch(0.16 0 0)` | Primary panels, cards, data tables |
| **Nested / Inset (Level 2)** | `oklch(0.965 0 0)` | `oklch(0.20 0 0)` | Table headers, wizard step trays, code blocks |
| **Floating (Level 3)** | `oklch(1.0 0 0)` | `oklch(0.22 0 0)` | Dropdowns, command palettes, tooltips (`shadow-lg`) |

### 2.2 Semantic Status Palette

Insurance states must be instantly recognizable. Never use color alone; pair with an explicit label or badge icon.

- **Active / In Force:** Emerald `oklch(0.62 0.17 145)` (`bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20`)
- **Pending / Quote:** Amber `oklch(0.72 0.16 75)` (`bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20`)
- **Lapsed / Cancelled:** Rose `oklch(0.57 0.22 25)` (`bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20`)
- **Financial / Invoiced:** Cobalt `oklch(0.55 0.19 255)` (`bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20`)
- **Draft / Superseded:** Muted `oklch(0.55 0 0)` (`bg-muted text-muted-foreground border-border`)

### 2.3 Interactive Accents

* **Primary Action:** Solid monochrome contrast (`bg-primary text-primary-foreground`) for authoritative confirmation actions ("Issue Risk Note", "Save Changes", "Generate Invoice").
* **Secondary Action:** Outlined with subtle hover background (`variant="outline" hover:bg-muted/60`).
* **Destructive Action:** Red ghost or solid destructive button reserved strictly for irrevocable actions (e.g., "Cancel Policy", "Delete Draft").

---

## 3. Typography & Financial Numerals

### 3.1 Typographic Scale & Roles

| Role | Class | Tracking | Weight | Example Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `text-2xl` | `tracking-tight` | `font-bold` | Client Name, Policy Header |
| **Section Heading** | `text-base` | `tracking-normal` | `font-semibold` | "Risk Details", "Payment Schedule" |
| **Body Text** | `text-sm` | `tracking-normal` | `font-normal` | Descriptions, dialog content |
| **Micro-Label** | `text-[11px]` | `tracking-wider uppercase` | `font-semibold text-muted-foreground` | "SUM INSURED", "KRA PIN", "START DATE" |
| **Code / Identity** | `text-xs font-mono` | `tracking-tight` | `font-medium` | UUIDs, Policy Numbers (`010/070/1/...`) |

### 3.2 The Financial Numeral Standard (Zero Proportional Numerals)

> **Strict Invariant:** Proportional numbers must never be used for money, sums insured, premiums, or tax levies. Proportional numbers cause ragged column alignment and misreading.

All financial amounts, rates, and monetary calculations must use:
```tsx
<span className="font-mono tabular-nums text-right font-medium">
  {formatCurrency(amount)}
</span>
```
* **Alignment:** Always right-align currency columns in tables and grid summaries.
* **Currency Symbol:** Standard prefix `KES` with non-breaking space (e.g., `KES 145,000.00`).
* **Endorsement Deltas:** Show explicit signs and color badges:
  * Premium increase: `+KES 4,500.00` (`text-rose-600 dark:text-rose-400`)
  * Premium credit: `-KES 2,100.00` (`text-emerald-600 dark:text-emerald-400`)

---

## 4. Layout Architecture & Workspace Density

```
+------------------------------------------------------------------------+
| App Header (Search ⌘K, User Profile, Notifications)                     |
+--------------+---------------------------------------------------------+
| Inset Sidebar| Breadcrumb: Clients > John Doe > Motor Private (KCA 123) |
|              +---------------------------------------------------------+
| • Clients    | Context Header: KCA 123B (Active)        [Issue RN] [+] |
| • Catalog    +---------------------------------------------------------+
| • Financials | Tabs: [Overview]   [Transaction Log]   [Documents]      |
| • Settings   |                                                         |
|              | Content Area (Grid / Data Table / Slide-over Sheet)     |
+--------------+---------------------------------------------------------+
```

### 4.1 Inset Sidebar Navigation
* **Variant:** Inset rounded container (`bg-sidebar border-sidebar-border`) anchored on the left.
* **Collapsible:** Collapses to iconography on narrower viewports.
* **Navigation Items:** Clean vertical list with active state indicated by `bg-sidebar-accent font-medium text-sidebar-accent-foreground` with a subtle 2px left border marker.

### 4.2 Tabular Data Density Rules
Tables are the operational core of the insurance system:
* **Row Height:** Compact 36px to 40px (`py-2 px-3`).
* **Sticky Headers:** `sticky top-0 bg-muted/80 backdrop-blur-xs z-10` with subtle bottom border.
* **Column Alignment:**
  * Left: Entity names, text descriptions, product titles.
  * Center: Status badges, date ranges, counts.
  * Right: Currency amounts, sums insured, premium breakdowns, action buttons.
* **Empty States:** Never render empty tables with blank space. Render a structured `EmptyState` component with a contextual illustration/icon, clear explanation, and a direct primary action.

---

## 5. Form & Wizard Architecture

Insurance transactions (New Business, Endorsements, Renewals) require multi-step data entry.

### 5.1 Wizard Design Rules
1. **Sequential Stepper:** Clear visual progress tracker displaying `Completed`, `Current`, and `Pending` stages.
2. **Sticky Financial Ticker:** When entering risk details or coverage extensions, a live calculation panel (Sum Insured -> Base Premium -> Levies -> Total Due) must remain visible in the side tray.
3. **No Blind Submissions:** The final wizard step must always be a **Summary & Reconciliation** view comparing previous state vs. new state before issuing the Risk Note.
4. **Inline Validation:** Validate fields on blur (`React Hook Form` + `Zod`). Show concise, human-readable error messages beneath the input; never rely solely on pop-up toasts for form validation.

---

## 6. Document & Print Layout Standard (`@media print`)

Risk Notes and Debit Notes are binding contracts. When printed or exported to PDF, they must render with the precision of an official insurance policy schedule.

```
+-------------------------------------------------------------+
| BROKER LETTERHEAD & REGISTRATION DETAILS                    |
| HealthWatch Insurance Brokers Ltd | KRA PIN: P051234567Z    |
+------------------------------+------------------------------+
| DEBIT NOTE / RISK NOTE NO:   | DATE OF ISSUE:               |
| RN-2026-0891                 | 18 October 2026              |
+------------------------------+------------------------------+
| INSURED: John Doe | PIN: A001234567M | PO Box 1234, Nairobi |
+-------------------------------------------------------------+
| POLICY DETAILS: Motor Private Comprehensive                 |
| Insurer: Old Mutual General Insurance | Policy: 010/070/... |
+-------------------------------------------------------------+
| ASSET & COVER SCHEDULE:                                     |
| Reg No: KCA 123B | Make: Toyota Prado | Value: KES 4,500,000|
+----------------------------------------------+--------------+
| PREMIUM BREAKDOWN:                           | AMOUNT (KES) |
| Basic Premium                                |   112,500.00 |
| Training Levy (0.2%)                         |       225.00 |
| Policy Holders Compensation Fund (0.25%)     |       281.25 |
| Stamp Duty                                   |        40.00 |
| TOTAL AMOUNT PAYABLE:                        |   113,046.25 |
+----------------------------------------------+--------------+
| BANKING DETAILS & PAYMENT TERMS                             |
| Authorized Signature & Stamp Block                          |
+-------------------------------------------------------------+
```

### Print CSS Constraints
* **Page Budget:** Exactly A4 dimensions (`@page { size: A4 portrait; margin: 12mm 15mm; }`).
* **Table Integrity:** `table { break-inside: avoid; }` and `tr { break-inside: avoid; }` to prevent rows splitting across pages.
* **Ink Economy & Contrast:** Force high-contrast pure black (`#000000`) text on white (`#FFFFFF`) background. Never use colored badge backgrounds or faint grays in print mode.
* **Hairline Dividers:** Standardize table and section dividers on `0.5pt solid #111111`.
