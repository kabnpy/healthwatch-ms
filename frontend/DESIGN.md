---

name: HealthWatch MS
description: Clean shadcn/ui Blue-themed insurance agency workspace with tabular financial precision and A4 legal output.
colors:
primary: "oklch(0.488 0.243 264.376)"
primary-hover: "oklch(0.424 0.199 265.638)"
primary-foreground: "oklch(0.97 0.014 254.604)"
background: "oklch(1 0 0)"
foreground: "oklch(0.145 0 0)"
card: "oklch(1 0 0)"
secondary: "oklch(0.967 0.001 286.375)"
secondary-foreground: "oklch(0.21 0.006 285.885)"
muted: "oklch(0.97 0 0)"
muted-foreground: "oklch(0.556 0 0)"
border: "oklch(0.922 0 0)"
ring: "oklch(0.708 0 0)"
destructive: "oklch(0.577 0.245 27.325)"
sidebar: "oklch(0.985 0 0)"
sidebar-primary: "oklch(0.546 0.245 262.881)"
status-active: "oklch(0.43 0.14 148)"
status-active-bg: "oklch(0.62 0.17 145 / 12%)"
status-pending: "oklch(0.47 0.14 65)"
status-pending-bg: "oklch(0.72 0.16 75 / 14%)"
status-lapsed: "oklch(0.46 0.19 25)"
status-lapsed-bg: "oklch(0.57 0.22 25 / 12%)"
status-invoiced: "oklch(0.45 0.19 260)"
status-invoiced-bg: "oklch(0.55 0.19 255 / 12%)"
print-ink: "#000000"
print-paper: "#ffffff"
print-hairline: "#111111"
typography:
display:
fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
fontSize: "1.875rem"
fontWeight: 800
lineHeight: 1.2
letterSpacing: "-0.025em"
headline:
fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
fontSize: "1.5rem"
fontWeight: 700
lineHeight: 1.25
letterSpacing: "-0.025em"
title:
fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
fontSize: "1rem"
fontWeight: 600
lineHeight: 1.5
letterSpacing: "0em"
body:
fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
fontSize: "0.875rem"
fontWeight: 400
lineHeight: 1.5
letterSpacing: "0em"
label:
fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
fontSize: "0.6875rem"
fontWeight: 600
lineHeight: 1.35
letterSpacing: "0.05em"
mono:
fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
fontSize: "0.8125rem"
fontWeight: 500
lineHeight: 1.4
letterSpacing: "-0.015em"
rounded:
sm: "6px"
md: "8px"
lg: "10px"
xl: "14px"
full: "9999px"
spacing:
xs: "4px"
sm: "8px"
md: "12px"
lg: "16px"
xl: "24px"
2xl: "32px"
components:
button-primary:
backgroundColor: "{colors.primary}"
textColor: "{colors.primary-foreground}"
typography: "{typography.body}"
rounded: "{rounded.md}"
padding: "8px 16px"
height: "36px"
button-primary-hover:
backgroundColor: "{colors.primary-hover}"
textColor: "{colors.primary-foreground}"
button-secondary:
backgroundColor: "{colors.secondary}"
textColor: "{colors.secondary-foreground}"
typography: "{typography.body}"
rounded: "{rounded.md}"
padding: "8px 16px"
height: "36px"
button-destructive:
backgroundColor: "{colors.destructive}"
textColor: "{colors.background}"
typography: "{typography.body}"
rounded: "{rounded.md}"
padding: "8px 16px"
height: "36px"
card:
backgroundColor: "{colors.card}"
textColor: "{colors.foreground}"
rounded: "{rounded.lg}"
padding: "24px"
input:
backgroundColor: "{colors.background}"
textColor: "{colors.foreground}"
typography: "{typography.body}"
rounded: "{rounded.md}"
padding: "4px 12px"
height: "36px"
badge-active:
backgroundColor: "{colors.status-active-bg}"
textColor: "{colors.status-active}"
typography: "{typography.label}"
rounded: "{rounded.full}"
padding: "2px 8px"
badge-pending:
backgroundColor: "{colors.status-pending-bg}"
textColor: "{colors.status-pending}"
typography: "{typography.label}"
rounded: "{rounded.full}"
padding: "2px 8px"
badge-lapsed:
backgroundColor: "{colors.status-lapsed-bg}"
textColor: "{colors.status-lapsed}"
typography: "{typography.label}"
rounded: "{rounded.full}"
padding: "2px 8px"
badge-invoiced:
backgroundColor: "{colors.status-invoiced-bg}"
textColor: "{colors.status-invoiced}"
typography: "{typography.label}"
rounded: "{rounded.full}"
padding: "2px 8px"
---

# Design System: HealthWatch MS

## Overview

**Creative North Star: "The Underwriter's Ledger"**

HealthWatch MS is an operational insurance agency workspace built on **shadcn/ui** (`base-nova` / `@base-ui/react` architecture) with the **Official Blue Theme Preset** (`b1Z5bafVA`: Neutral base + Blue interactive primary in OKLCH). The interface balances institutional clarity with high-density portfolio servicing: account managers inspect multi-vehicle risk schedules, statutory tax levies, 6-stage renewal pipelines, and locked payment allocations without visual clutter or ambiguity.

Every screen adopts standard composable `shadcn/ui` primitives first and tunes hierarchy through semantic CSS tokens rather than bespoke one-off classes. Interactive web views prioritize rapid scanning, keyboard accessibility, and context preservation (`Sheet` slide-over drawers and tabbed views over nested modals), while `@media print` and document templates transform schedules into authoritative A4 portrait legal contracts.

**Key Characteristics:**

- **shadcn/ui First:** Built strictly from composable `shadcn/ui` Base UI primitives (`Button`, `Card`, `Table`, `Sheet`, `Badge`, `Dialog`, `Form`, `Sidebar`, `Tabs`) styled via CSS custom properties in `src/index.css`.
- **Authoritative Blue Primary:** High-contrast Cobalt Blue primary action token (`--primary`) paired with crisp neutral surfaces (`--background`, `--card`, `--muted`, `--sidebar`).
- **Semantic Insurance Statuses:** Five domain-specific status token families (`active`, `pending`, `lapsed`, `invoiced`, `draft`) always paired with explicit text labels.
- **Zero Proportional Numerals:** Mandatory right-aligned `font-mono tabular-nums` formatting for every `KES` currency amount, rate percentage, policy number, and statutory levy.
- **Dual Legal Output:** Interactive responsive web workspace on screen; strict monochrome A4 portrait (`12mm 15mm` margin, `0.5pt` hairline border) legal instruments in print.

## Colors

The palette pairs **shadcn/ui Neutral** structural surfaces with the **shadcn/ui Blue** primary action ramp and five semantic insurance state tokens calibrated in perceptual OKLCH space for both Light and Dark themes.

### Primary

- **Underwriter Blue** (`--primary`): Used strictly for primary interactive confirmation actions ("Issue Risk Note", "Record Payment", "Add Client"), active navigation indicators, and selected control states. Drops to a deeper cobalt in dark mode (`oklch(0.424 0.199 265.638)`) to preserve WCAG AAA contrast against its icy foreground (`--primary-foreground`).
- **Sidebar Cobalt** (`--sidebar-primary`): Highlights the active route and primary action tile inside the collapsible inset `Sidebar`.

### Secondary

- **Cool Slate Fill** (`--secondary` / `--secondary-foreground`): Supports secondary actions, filter triggers, and non-primary toolbar buttons without competing with the primary blue CTA.

### Tertiary

- **Active Emerald** (`--status-active` / `--status-active-bg`): Indicates `Active` / `In Force` policy containers, verified `Insurer Receipt` records, and settled `paid` renewals.
- **Pending Amber** (`--status-pending` / `--status-pending-bg`): Marks `awaiting_carrier`, `changes_requested`, and unverified `Proof of Payment` items requiring agent follow-up.
- **Lapsed Rose** (`--status-lapsed` / `--status-lapsed-bg` and `--destructive`): Signals `Lapsed` or `Cancelled` policies, overdue debits, and irrevocable destructive actions.
- **Invoiced Cobalt** (`--status-invoiced` / `--status-invoiced-bg`): Identifies issued `Invoice` debits and `carrier_received` / `client_invited` renewal stages.

### Neutral

- **Paper Canvas & Elevated Card** (`--background`, `--card`, `--popover`): Pure neutral white in light mode; stepped charcoal layering in dark mode (`oklch(0.145 0 0)` canvas under `oklch(0.205 0 0)` cards, popovers, and sidebar).
- **Inset & Muted Surface** (`--muted`, `--sidebar`): Soft neutral tint used for sticky table headers, wizard step trays, code blocks, and the inset navigation rail.
- **Ink & Muted Copy** (`--foreground`, `--muted-foreground`): High-contrast primary copy paired with balanced secondary metadata and micro-labels.
- **Hairline Divider & Focus Ring** (`--border`, `--input`, `--ring`): Crisp 1px structural borders (`10%` translucent white in dark mode) and `3px` focus rings.

### Named Rules

**The One Action Hue Rule.** `--primary` (Underwriter Blue) is reserved exclusively for interactive actions, links, focus rings, and active selection states. Never apply `--primary` to decorative icons, section headings, or status badges; conversely, never use semantic status colors (such as Emerald green) on primary action buttons.

**The Paired Status Rule.** Insurance and financial states must never rely on color alone (WCAG 1.4.1). Every status indicator uses a semantic `Badge` variant (`active`, `pending`, `lapsed`, `invoiced`, `draft`) with an explicit canonical term from `GLOSSARY.md`.

## Typography

**Display Font:** Inter (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Body Font:** Inter (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, SFMono-Regular, monospace` fallback)

**Character:** Clean, neutral geometric-humanist sans-serif (`Inter`) for dense operational legibility, paired with a disciplined tabular monospace (`JetBrains Mono`) for financial schedules, policy numbers, KRA PINs, and UUIDs.

### Hierarchy

- **Display** (`800` weight, `1.875rem` / `30px`, `1.2` line-height, `-0.025em` tracking): Workspace root headers (e.g., "Agency Dashboard").
- **Headline** (`700` weight, `1.5rem` / `24px`, `1.25` line-height, `-0.025em` tracking): Client portfolio names, policy detail titles, and sheet headers.
- **Title** (`600` weight, `1rem` / `16px`, `1.5` line-height): Card titles, section headings ("Risk Details", "Payment Schedule", "Renewal Triage").
- **Body** (`400` weight, `0.875rem` / `14px`, `1.5` line-height, max `65ch`–`75ch` for prose): Standard operational copy, form labels, and table text cells.
- **Label** (`600` weight, `0.6875rem` / `11px`, `1.35` line-height, `0.05em` tracking, uppercase): Table column headers (`TableHead`) and field micro-labels ("SUM INSURED", "KRA PIN", "EFFECTIVE DATE").
- **Mono** (`500` weight, `0.8125rem` / `13px`, `1.4` line-height, `tabular-nums`): All `KES` currency figures, percentage rates, policy numbers (`010/070/1/...`), vehicle registration plates (`KCA 123B`), and document serials (`RN-2026-0891`).

### Named Rules

**The Zero Proportional Numerals Rule.** Proportional numerals are strictly forbidden for money, sums insured, premiums, tax levies, and running balances. Every financial figure must combine `font-mono tabular-nums text-right font-medium` with the `KES ` non-breaking prefix and two decimal places (`KES 145,000.00`).

## Layout

HealthWatch MS uses an **Inset App Shell** layout (`SidebarProvider` + collapsible `AppSidebar` + `SidebarInset`) wrapping a centered `max-w-7xl` (`1280px`) operational canvas with `24px` (`p-6`) to `32px` (`md:p-8`) outer padding.

- **Workspace Grid:** Summary metrics and secondary inspection panels sit in responsive CSS Grid layouts (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` with `16px` / `gap-4` spacing), stacked above `24px` (`gap-6`) primary work queues and data tables.
- **Tabular Density:** Operational tables (`Table`) enforce compact `36px`–`40px` row heights (`px-3 py-2` cells, `h-10 px-3` headers) with sticky headers (`sticky top-0 z-10 bg-muted/80 backdrop-blur-xs`). Entity names align left; status badges and date ranges align center/left; all monetary amounts and row actions align right.
- **Context Preservation:** Sub-flows (logging insurer terms, recording payment allocations, uploading KYC documents, editing client details) open in a right-hand `Sheet` slide-over or inline `Tabs` panel so the agent never loses sight of the underlying portfolio or policy record.
- **Print / Document Sheet (`@media print`):** Collapses all app shell chrome (`print:hidden`) and renders a bounded A4 portrait sheet (`210mm` width, `12mm 15mm` page margins) with `break-inside: avoid` on tables and rows.

## Elevation & Depth

HealthWatch MS uses **Border-First Tonal Layering** with restrained structural shadows. Surfaces are separated primarily by `1px solid var(--border)` hairlines and subtle background luminance steps rather than heavy drop shadows.

### Shadow Vocabulary

- **Control & Card Rest** (`shadow-xs` / `0 1px 2px 0 rgb(0 0 0 / 0.05)`): Applied to `Card`, `Input`, and ` outline` `Button` primitives to give subtle tactile boundaries in light mode.
- **Floating Overlay** (`shadow-lg` / `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): Reserved exclusively for Level 3 floating surfaces (`Popover`, `DropdownMenu`, `Command` palette, `Dialog`, `Sheet`, and `DocumentJobStatusTray`).

### Named Rules

**The Flat-In-Print Rule.** In `@media print`, all shadows, translucent fills, and backdrop blurs are stripped; depth and hierarchy are expressed strictly through `#000000` text on `#FFFFFF` paper and `0.5pt solid #111111` (`.print-hairline`) rules.

## Shapes

The system uses the **shadcn/ui `0.625rem` (`10px`) base radius scale** (`--radius: 0.625rem`), creating crisp, approachable geometry across containers and controls:

- **Small (`--radius-sm` / `6px`):** Compact inline badges, keyboard shortcut kbd tags, and dense icon buttons.
- **Medium (`--radius-md` / `8px`):** Standard `Button`, `Input`, `Select`, and `Textarea` controls.
- **Large (`--radius-lg` / `10px`):** `Card` containers, `Table` wrappers, `Alert` banners, and `Dialog` panels.
- **Full Pill (`rounded-full`):** Semantic status `Badge` pills (`Active`, `Awaiting Insurer`, `Paid`).

## Components

### Buttons (`@/components/ui/button`)

- **Shape:** Medium rounded corners (`8px` / `rounded-md`), `36px` (`h-9`) desktop height with automatic `44px` (`min-h-11 sm:min-h-0`) touch target expansion on mobile viewports.
- **Primary (`variant="default"`):** Solid Underwriter Blue fill (`bg-primary text-primary-foreground`) with `hover:bg-primary/90`. Used for the single primary action in a header, sheet, or form.
- **Hover / Focus:** `transition-all` with a `3px` focus ring (`focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`).
- **Secondary / Outline / Ghost / Destructive:** `outline` (`border bg-background shadow-xs hover:bg-accent`) for secondary toolbar actions; `secondary` (`bg-secondary text-secondary-foreground`) for low-emphasis filled triggers; `ghost` for inline table row and menu triggers; `destructive` (`bg-destructive text-white`) strictly for irreversible operations.

### Badges / Status Pills (`@/components/ui/badge`)

- **Style:** Full pill (`rounded-full`), `1px` border, `px-2 py-0.5`, `12px` (`text-xs font-medium`).
- **State Variants:** Domain-specific semantic variants (`variant="active"`, `variant="pending"`, `variant="lapsed"`, `variant="invoiced"`, `variant="draft"`) backed by `--status-*` CSS tokens, alongside standard `default`, `secondary`, `destructive`, and `outline` variants.

### Cards / Containers (`@/components/ui/card`)

- **Corner Style:** `10px` (`rounded-lg`).
- **Background:** `bg-card text-card-foreground` (`oklch(1 0 0)` light / `oklch(0.205 0 0)` dark).
- **Shadow Strategy:** `shadow-xs` with `1px` `border-border`.
- **Internal Padding:** `24px` (`py-6`, `px-6` in `CardHeader` / `CardContent` / `CardFooter`) with `24px` (`gap-6`) vertical rhythm; compact operational list cards use `p-0` on `CardContent` to let `divide-y` rows span edge-to-edge.

### Inputs / Fields (`@/components/ui/input`, `currency-input`, `textarea`, `select`)

- **Style:** `36px` (`h-9`) height, `8px` (`rounded-md`) radius, `1px` `border-input`, `shadow-xs`, `dark:bg-input/30`. `CurrencyInput` prefixes `KES` and enforces tabular numeral entry; `textarea` progressively enhances with `field-sizing: content` (`max-height: 20lh`).
- **Focus:** `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`.
- **Error / Disabled:** `aria-invalid:border-destructive aria-invalid:ring-destructive/20` paired with inline `FormMessage` text below the field; disabled controls apply `disabled:opacity-50 disabled:cursor-not-allowed`.

### Navigation (`@/components/Sidebar/AppSidebar`, `@/components/ui/sidebar`)

- **Style:** Collapsible inset sidebar (`bg-sidebar border-sidebar-border`) with icon-collapse mode on narrower viewports, paired with top `Header` breadcrumb context and `DocumentJobStatusTray` for async PDF generation feedback.

### Data Tables (`@/components/ui/table`)

- **Style:** Rounded `10px` (`rounded-lg border`) scroll container with sticky frosted header (`sticky top-0 z-10 bg-muted/80 backdrop-blur-xs`), `11px` uppercase tracked `TableHead` labels (`h-10 px-3`), and compact `px-3 py-2` `TableCell` rows with `hover:bg-muted/50`.

## Do's and Don'ts

### Do:

- **Do** build every new screen, dialog, form, and table from `@/components/ui/*` (`shadcn/ui`) primitives and semantic CSS variables (`bg-primary`, `bg-card`, `text-muted-foreground`, `border-border`).
- **Do** use `<Badge variant="active" | "pending" | "lapsed" | "invoiced" | "draft">` with canonical `GLOSSARY.md` labels for all policy, renewal, and invoice statuses.
- **Do** format all monetary figures, sums insured, and tax levies with `font-mono tabular-nums text-right font-medium` and the `KES ` prefix (`KES 113,046.25`).
- **Do** provide an explicit `aria-label` (or `<span className="sr-only">`) on every `size="icon"` button in action menus, table rows, and trays.
- **Do** use `Sheet` slide-over drawers and `Tabs` for contextual sub-flows (renewal state transitions, payment allocations, KYC uploads) to preserve workspace context.

### Don't:

- **Don't** hardcode raw Tailwind palette classes (such as `bg-emerald-600` or `bg-indigo-500`) on primary action buttons; primary CTAs must always use `Button` (`variant="default"`, which maps to `--primary` Blue).
- **Don't** render proportional numerals or left-aligned currency columns in tables, fee breakdowns, or financial summaries.
- **Don't** use emojis in buttons, badges, dialogs, empty states, or toast notifications; use monochrome Lucide icons paired with clear text labels.
- **Don't** use continuous looping animations (`animate-pulse`, `animate-bounce`) on static dashboard icons or status badges; reserve motion for active loading skeletons (`Skeleton`), spinners (`LoadingButton`), and state transitions.
- **Don't** allow colored backgrounds, faint gray text, or split table rows (`break-inside: avoid`) to leak into `@media print` A4 legal documents.
