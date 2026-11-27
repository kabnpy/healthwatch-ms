# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Salaried insurance agency account managers, underwriting operations staff, and principals at HealthWatch managing Kenyan retail and SME client portfolios (including 2–6 vehicle mini-fleets, domestic packages, commercial fire/burglary/WIBA, and defined-benefit family medical covers). Users operate on desktop monitors in high-volume agency workflows and occasionally inspect records or statements on mobile viewports.

## Product Purpose

HealthWatch MS replaces physical paper filing cabinets and fragmented spreadsheets with a unified, deterministic insurance agency workspace. Account managers use it to capture client KYC (`Acquisition Form`), execute verified fixed-point `PremiumCalculation` runs against published `RateTableVersion` schedules and Kenyan statutory levies (`0.20%` ITL, `0.25%` PHCF, `KES 40.00` Stamp Duty), drive the 6-stage annual `Renewal` lifecycle, reconcile `Invoice` receivables against verified `PaymentRecord` and `PaymentAllocation` entries, and generate binding legal documents (`RiskNote`, `Invoice`, `Statement`).

## Positioning

A Kenyan intermediary insurance workspace built around statutory compliance (Insurance Act Cap 487 Section 156A Cash-and-Carry and tripartite `IPFAgreement` rules), single-underwriter policy containers (`Policy`), deterministic backend rating authority (`PremiumCalculation`), and dual-mode output: high-density interactive shadcn/ui operational screens paired with formal A4 portrait legal instruments (`@media print`).

## Operating Context

- **Carrier Liaison Workflow:** Account managers receive renewal notices, policy schedules, and digital motor certificates (DMIC) from dedicated relationship managers at Kenyan underwriting partners (e.g., Old Mutual, Britam, APA, Jubilee) and upload them into the Document Vault alongside certified vehicle valuations.
- **Dual Rating Paradigms:** Supports both indemnity asset/sum-insured valuation (Motor Comprehensive, Motor TPO Cap 405 tariffs, Domestic Package, Fire, Burglary, All Risks, WIBA) and demographic/tier-based defined-benefit medical rating (Inpatient tiers A–D with optional Outpatient, Maternity, and Dental/Optical riders exempt from Stamp Duty).
- **Append-Only Financial Integrity:** Client-submitted `Proof of Payment` is separated from verified `PaymentRecord` funds and locked `PaymentAllocation` applications; agency commission (`CommissionSchedule` with 5% WHT) unlocks only upon `Insurer Receipt` verification.

## Capabilities and Constraints

- **Stack:** React 19, TypeScript, Vite, TanStack Router & Query, Tailwind CSS v4, and `shadcn/ui` (`base-nova` style, `blue` theme preset, `@base-ui/react` primitives, Lucide icons) backed by FastAPI, SQLModel, PostgreSQL, and WeasyPrint/Jinja2 document rendering.
- **Canonical Vocabulary:** All UI labels, headings, statuses, and empty states must strictly adhere to the terms and `_Avoid_` rules in [`GLOSSARY.md`](../GLOSSARY.md).
- **Financial Numeral Invariant:** All currency amounts (`KES`), sums insured, rates, and tax levies must render in right-aligned `font-mono tabular-nums` with fixed-point two-decimal precision (`KES 145,000.00`)—never proportional numerals or floating-point approximations.
- **Dual Legal Output:** Web views optimize for operational speed and context preservation (`Sheet` slide-overs and tabs rather than nested modals), while `@media print` and server-rendered documents enforce A4 portrait dimensions (`12mm 15mm` margins), pure monochrome contrast (`#000000` on `#FFFFFF`), `0.5pt` hairline dividers, and unbroken table rows.

## Brand Commitments

- **Design Foundation:** Clean, authoritative `shadcn/ui` component architecture with the **Blue** theme preset (`oklch` CSS variables across light and dark modes), paired with semantic insurance status tokens (`Active`, `Pending`, `Lapsed`, `Invoiced`, `Draft`).
- **Voice & Iconography:** Grounded, concise, operational prose. Monochrome Lucide icons paired with explicit text labels (or `aria-label` on icon-only controls); zero emojis in UI buttons, badges, dialogs, or toasts.

## Evidence on Hand

- Domain glossary and bounded context definitions in [`GLOSSARY.md`](../GLOSSARY.md)
- Product workflows and Kenyan rating math in [`docs/01_product_specs.md`](../docs/01_product_specs.md)
- Design system specification in [`docs/02_design_system.md`](../docs/02_design_system.md)
- Coding and financial precision standards in [`CODING_STANDARDS.md`](../CODING_STANDARDS.md)
- Reference catalog and Kenyan market seed fixtures in [`docs/04_reference_catalog_and_seeding.md`](../docs/04_reference_catalog_and_seeding.md)

## Product Principles

1. **Unambiguous Operational State:** Every policy status, renewal stage, receivable balance, and effective date must be immediately scannable via paired semantic badge tokens and explicit labels—never color alone.
2. **Adopt `shadcn/ui` First, Tune via Tokens:** Use standard, composable `shadcn/ui` primitives and CSS variables (`--primary`, `--card`, `--muted`, `--sidebar-*`, `--status-*`) rather than ad-hoc one-off component styling.
3. **Tabular Financial Precision:** Right-aligned `tabular-nums` monospace figures and reconciliation summaries precede every binding contract or ledger mutation.
4. **Context Preservation Over Interruption:** Keep the portfolio or policy context visible using `Sheet` drawers, split panes, and sticky financial tickers instead of full-page redirects or modal stacks.

## Accessibility & Inclusion

- WCAG 2.1 AA contrast compliance across both Light and Dark themes (`>= 4.5:1` for normal text, `>= 3:1` for UI boundaries and large text).
- Touch-friendly `44x44px` (`min-h-11 min-w-11` on mobile viewports, compact on desktop `sm:min-h-0`) interactive targets and explicit `aria-label` attributes on all icon-only controls.
- Full keyboard navigation, visible `:focus-visible` rings (`ring-ring/50 ring-[3px]`), and `color-scheme` synchronization for native browser controls and scrollbars.
