# Design System Specification: HealthWatch MS

> **DOCUMENT PURPOSE:** This specification defines the concrete, enforceable UI/UX standards, `shadcn/ui` component architecture, OKLCH token contracts, typography hierarchies, and A4 print specifications for the HealthWatch MS insurance workspace. Machine-readable tokens and Stitch/Impeccable definitions live alongside this guide in [`frontend/DESIGN.md`](../frontend/DESIGN.md) and [`frontend/src/index.css`](../frontend/src/index.css).

---

## 1. Product Design Philosophy

HealthWatch MS is an **insurance agency workspace**. Its primary users (salaried account managers, underwriting operations staff, and principals) work with multi-variable risk schedules, statutory financial levies, temporal policy modifications (`Endorsement`), 6-stage `Renewal` pipelines, and binding legal contracts (`RiskNote`, `Invoice`, `Statement`).

### Core Pillars

1. **`shadcn/ui` First, Tuned by Preset:** Every screen is assembled from standard, accessible `shadcn/ui` primitives (`@/components/ui/*`, `base-nova` style on `@base-ui/react`) powered by preset `b1PzeK` in Tailwind CSS v4. Customize appearance by consuming semantic CSS variables—never by writing ad-hoc component overrides.
2. **Reliability & Unambiguous State:** Statuses, currency amounts, effective dates, and policy numbers must have unmistakable visual fidelity and strict alignment.
3. **Information Density with Breathing Room:** Dense operational data (tables, schedules, ledger allocations) is balanced by consistent spatial rhythm, avoiding both bloated consumer-app whitespace and cramped legacy spreadsheets.
4. **Context Preservation:** Complex sub-flows (contact management, document uploads, renewal state transitions, payment allocations) use slide-over sheets (`Sheet`) and contextual `Tabs` rather than disorienting full-page redirects or nested modal stacks.
5. **Dual Legal Output:** Web screens are fast, interactive operational tools; printed documents (`RiskNote`, `Invoice`, `Statement`) are formal legal instruments adhering to strict A4 portrait layout rules.

### 1.1 Interface Voice & Copywriting Standards

- **Tone:** Clear, grounded, respectful, and professional. Speak directly to the operational reality of managing client portfolios and paperless records.
- **Visuals over Emoji:** Do not use emojis in UI buttons, dialogs, badges, tooltips, empty states, or toast notifications. Use clean, monochrome Lucide icons paired with explicit text labels (or `aria-label` on `size="icon"` buttons).
- **Approved Entity Terms:** Use the canonical terms and obey the `_Avoid_` lists defined in [`GLOSSARY.md`](../GLOSSARY.md) across all labels, headings, and empty states.

---

## 2. Color & Surface Architecture (`shadcn/ui` Blue Preset)

HealthWatch MS uses **OKLCH color tokens** in Tailwind CSS v4 (`frontend/src/index.css`), adopting the official `shadcn/ui` **Blue** preset (`baseColor: "neutral"`, `theme: "blue"`, `radius: "0.625rem"`) paired with `color-scheme: light` / `color-scheme: dark` so native browser scrollbars, date pickers, and form controls adapt automatically.

### 2.1 Surface & Interactive Tokens

| Token | Light Mode (`:root`) | Dark Mode (`.dark`) | Usage |
| :--- | :--- | :--- | :--- |
| **`--background` / `--foreground`** | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.145 0 0)` / `oklch(0.985 0 0)` | Main workspace canvas and primary body copy |
| **`--card` / `--card-foreground`** | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` | Elevated cards, panels, data tables (`shadow-xs border`) |
| **`--popover` / `--popover-foreground`** | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` | Floating overlays: `Popover`, `DropdownMenu`, `Command`, `Sheet` (`shadow-lg`) |
| **`--sidebar` / `--sidebar-foreground`** | `oklch(0.985 0 0)` / `oklch(0.145 0 0)` | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` | Collapsible inset navigation rail (`AppSidebar`) |
| **`--muted` / `--muted-foreground`** | `oklch(0.97 0 0)` / `oklch(0.556 0 0)` | `oklch(0.269 0 0)` / `oklch(0.708 0 0)` | Sticky table headers (`bg-muted/80`), wizard trays, secondary copy |
| **`--primary` / `--primary-foreground`** | `oklch(0.488 0.243 264.376)` / `oklch(0.97 0.014 254.604)` | `oklch(0.424 0.199 265.638)` / `oklch(0.97 0.014 254.604)` | Primary interactive CTAs ("Issue Risk Note", "Record Payment", "Add Client") |
| **`--secondary` / `--secondary-foreground`** | `oklch(0.967 0.001 286.375)` / `oklch(0.21 0.006 285.885)` | `oklch(0.274 0.006 286.033)` / `oklch(0.985 0 0)` | Secondary filled triggers and supporting controls |
| **`--destructive`** | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Irrevocable destructive actions and validation errors |
| **`--border` / `--input` / `--ring`** | `oklch(0.922 0 0)` / `oklch(0.708 0 0)` | `oklch(1 0 0 / 10%)` / `oklch(1 0 0 / 15%)` / `oklch(0.556 0 0)` | Structural hairline dividers, field borders, and `3px` focus rings |

### 2.2 Semantic Insurance Status Tokens (`Badge` Variants)

Insurance and ledger states must be instantly recognizable and never rely on color alone (WCAG 1.4.1). Use the first-class `<Badge variant="...">` variants backed by `--status-*` CSS tokens in `frontend/src/index.css`:

| `<Badge variant>` | Domain States | Token Family | Visual Character |
| :--- | :--- | :--- | :--- |
| **`variant="active"`** | `Active`, `In Force`, `paid`, `completed`, Verified `Insurer Receipt` | `--status-active-*` | Emerald (`oklch(0.62 0.17 145)`) tint, text, and border |
| **`variant="pending"`** | `awaiting_carrier`, `changes_requested`, Unverified `Proof of Payment` | `--status-pending-*` | Amber (`oklch(0.72 0.16 75)`) tint, text, and border |
| **`variant="lapsed"`** | `Lapsed`, `Cancelled`, `declined`, Overdue Debit | `--status-lapsed-*` | Rose (`oklch(0.57 0.22 25)`) tint, text, and border |
| **`variant="invoiced"`** | `Issued` Invoice, `carrier_received`, `client_invited` | `--status-invoiced-*` | Cobalt (`oklch(0.55 0.19 255)`) tint, text, and border |
| **`variant="draft"`** | `Draft`, `Superseded`, `retired` RateTableVersion | `--status-draft-*` | Neutral muted surface and border |

### 2.3 Interactive Action Rules

- **One Action Hue (`--primary`):** Primary confirmation buttons (`<Button>` default variant) always use `--primary` (Underwriter Blue). Never hardcode status colors (like `bg-emerald-600`) onto primary action buttons.
- **Secondary Action:** `<Button variant="outline">` or `<Button variant="secondary">`.
- **Destructive Action:** `<Button variant="destructive">` reserved strictly for irrevocable actions (e.g., cancelling a policy or deleting a draft).

---

## 3. Typography & Financial Numerals

### 3.1 Font Stacks & Typographic Scale

Declared in `@theme inline` inside `frontend/src/index.css`:
- **`--font-sans` / `--font-heading`:** `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif`
- **`--font-mono`:** `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

| Role | Class | Tracking | Weight | Example Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Workspace Display** | `text-3xl` | `tracking-tight` | `font-extrabold` | Root workspace title ("Agency Dashboard") |
| **Page Title** | `text-2xl` | `tracking-tight` | `font-bold` | Client Name, Policy Header, Sheet Title |
| **Section Heading** | `text-base` | `tracking-normal` | `font-semibold` | "Risk Details", "Payment Schedule", CardTitle |
| **Body Text** | `text-sm` | `tracking-normal` | `font-normal` | Descriptions, form controls, dialog content |
| **Micro-Label** | `text-[11px]` | `tracking-wider uppercase` | `font-semibold text-muted-foreground` | `TableHead` cells, "SUM INSURED", "KRA PIN", "START DATE" |
| **Code / Identity** | `text-xs font-mono` | `tracking-tight` | `font-medium` | UUIDs, Policy Numbers (`010/070/1/...`), Vehicle Reg (`KCA 123B`) |

### 3.2 The Financial Numeral Standard (Zero Proportional Numerals)

> **Strict Invariant:** Proportional numbers must never be used for money, sums insured, premiums, rates, or tax levies. Proportional numbers cause ragged column alignment and misreading.

All financial amounts, rates, and monetary calculations must use:
```tsx
<span className="font-mono tabular-nums text-right font-medium">
  {formatCurrency(amount)}
</span>
```
- **Alignment:** Always right-align currency columns in tables and grid summaries.
- **Currency Symbol:** Standard prefix `KES` with non-breaking space and fixed two-decimal precision (e.g., `KES 145,000.00`).
- **Endorsement Deltas:** Show explicit signs:
  - Premium increase: `+KES 4,500.00` (`text-status-lapsed-foreground`)
  - Premium credit: `-KES 2,100.00` (`text-status-active-foreground`)

---

## 4. Layout Architecture & Workspace Density

```
+------------------------------------------------------------------------+
| App Header (SidebarTrigger, Breadcrumb, Theme Toggle, User Menu)       |
+--------------+---------------------------------------------------------+
| Inset Sidebar| Breadcrumb: Clients > John Doe > Motor Private (KCA 123)|
|              +---------------------------------------------------------+
| • Dashboard  | Context Header: KCA 123B [Active]        [Issue RN] [+] |
| • Clients    +---------------------------------------------------------+
| • Policies   | Tabs: [Overview]   [Renewals & Endorsements]  [Vault]   |
| • Renewals   |                                                         |
| • Financials | Content Area (Grid / Data Table / Slide-over Sheet)     |
| • Catalog    |                                                         |
+--------------+---------------------------------------------------------+
```

### 4.1 Inset Sidebar Navigation (`@/components/ui/sidebar`)
- **Variant:** Collapsible inset container (`bg-sidebar border-sidebar-border`) anchored on the left inside `SidebarProvider` + `SidebarInset`.
- **Main Container:** `main` uses `flex-1 p-6 md:p-8` wrapping a centered `mx-auto max-w-7xl` container.

### 4.2 Tabular Data Density Rules (`@/components/ui/table`)
Tables are the operational core of the insurance workspace:
- **Row Height:** Compact `36px` to `40px` (`px-3 py-2` in `TableCell`, `h-10 px-3` in `TableHead`).
- **Sticky Headers:** `TableHeader` enforces `sticky top-0 z-10 bg-muted/80 backdrop-blur-xs [&_tr]:border-b`.
- **Column Alignment:**
  - Left: Entity names, text descriptions, product titles.
  - Center / Left: Status badges (`<Badge variant="...">`), date ranges, counts.
  - Right: Currency amounts (`font-mono tabular-nums text-right`), sums insured, premium breakdowns, row action menus.
- **Empty States:** Never render empty tables with blank space. Render the structured `EmptyState` component with a monochrome Lucide icon, clear explanation, and a direct primary or secondary action.

---

## 5. Form, Dialog & Wizard Architecture

Insurance transactions (New Business `Acquisition Form`, `Endorsement`, `Renewal` transitions, `PaymentAllocation`) require structured, error-resistant data entry.

### 5.1 Disclosure & Wizard Rules
1. **Place Forms After Intent:** On browse and portfolio pages, creation and transition forms live inside a `Sheet` or `Dialog` triggered by an explicit CTA button—never taking permanent vertical space above the fold.
2. **Sequential Stepper & Sticky Financial Ticker:** When entering risk details or coverage extensions, a live calculation panel (`Sum Insured -> Net Base Premium -> ITL (0.20%) -> PHCF (0.25%) -> Stamp Duty -> Total Payable`) remains visible.
3. **No Blind Submissions:** Final confirmation steps display a reconciliation summary before issuing a `RiskNote`, `Invoice`, or `PaymentAllocation`.
4. **Inline Validation & Progressive Textarea Sizing:** Validate fields with `React Hook Form` + `Zod` (`Controller` + `Field`), rendering human-readable `FieldError` errors beneath inputs. Textareas auto-grow via `@supports (field-sizing: content)` up to `20lh`.
5. **Accessible Icon Controls:** Every `size="icon"` button must provide an explicit `aria-label` (or `<span className="sr-only">`).

---

## 6. Document & Print Layout Standard (`@media print`)

`RiskNote`, `Invoice`, and `Statement` outputs (`backend/app/templates/documents/` and print routes) are formal legal and accounting instruments.

```
+-------------------------------------------------------------+
| AGENCY LETTERHEAD & IRA / KRA REGISTRATION DETAILS          |
| HealthWatch Insurance Agency | KRA PIN: P051234567Z         |
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
| Net Base Premium                             |   112,500.00 |
| Training Levy (0.20%)                        |       225.00 |
| Policyholders Compensation Fund (0.25%)      |       281.25 |
| Stamp Duty                                   |        40.00 |
| TOTAL AMOUNT PAYABLE:                        |   113,046.25 |
+----------------------------------------------+--------------+
| SECTION 156A STATUTORY NOTICE & REMITTANCE DETAILS          |
| Authorized Signatory & Official Agency Stamp Block          |
+-------------------------------------------------------------+
```

### Print & Document CSS Constraints
- **Page Budget:** Exactly A4 portrait dimensions (`@page { size: A4 portrait; margin: 12mm 15mm; }`). When previewed on desktop viewports, standalone HTML documents sit inside a bounded A4 sheet (`max-width: 210mm`) so label-to-amount eye travel never stretches across a wide monitor.
- **Table Integrity:** `table { break-inside: avoid; }` and `tr { break-inside: avoid; }` to prevent schedule rows splitting across pages.
- **Ink Economy & Contrast:** Force high-contrast pure black (`#000000`) text on white (`#FFFFFF`) background in `@media print`. Strip all colored badge fills, drop shadows, and SVG color fills in print mode.
- **Hairline Dividers:** Standardize table and section dividers on `0.5pt solid #111111` (`.print-hairline`).

---

## 7. Design Tooling & Agent Workflow

When building, reviewing, or refining any UI surface in HealthWatch MS, follow this 4-stage tool workflow:

| Stage | Tool / Skill | How to Use It |
| :--- | :--- | :--- |
| **1. Component & Token Lookup** | **`shadcn` MCP** (`npx -y shadcn@latest mcp`) + `frontend/DESIGN.md` | Inspect `@shadcn` registry items (`search_items_in_registries`, `view_items_in_registries`, `get_item_examples_from_registries`) and add primitives via `bunx shadcn@latest add <component>`. Always build with `@/components/ui/*` first. |
| **2. Web Platform & UX Principles** | **`modern-web-guidance`** + **`better-design`** (`get-ui-principle`, `get-ux-principle`) | Query `npx -y modern-web-guidance@latest search "<pattern>"` for modern HTML/CSS/a11y rules and call `get-ui-principle` / `get-ux-principle` before styling or adding complex flows. |
| **3. Implementation** | `frontend/src/index.css` + `@/components/ui/*` | Style exclusively with the `shadcn/ui` Blue preset tokens (`--primary`, `--card`, `--muted`, `--status-*`) and `font-mono tabular-nums` for `KES` figures. |
| **4. Automated & Live Verification** | **`impeccable` CLI** + **`playwright` MCP** + **`better-design`** (`check-comprehension`, `inspect-spacing`) | Run `impeccable detect --json <target>` for static anti-pattern checks, and use Playwright MCP at `390px`, `1440px`, and `1728px` to capture live DOM evidence for `inspect-spacing` and `check-comprehension`. |
