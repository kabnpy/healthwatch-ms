---
name: qa-journey
description: >-
  Browser-level QA and end-to-end testing with Playwright. Use when verifying UI
  changes, writing or fixing specs in frontend/tests, or checking that a user can
  move through the application without errors.
---

# QA Journeys with Playwright

Specs live in `frontend/tests/`. Config: `frontend/playwright.config.ts`. The
`setup` project logs in once and every spec reuses that session.

## 1. Run the stack
- The backend, database, and frontend must be running (`./run status`).
- Worktrees share ports 5432, 8000, and 5173. Run one stack at a time and stop it
  when finished.
- Run specs: `cd frontend && bunx playwright test tests/<file>.spec.ts`.
  Add `--headed` or `--ui` when debugging. Traces are kept on first retry.

## 2. Writing specs
- Prefer user-facing locators: `getByRole`, `getByLabel`, `getByText`. Fall back
  to `getByTestId` and add a `data-testid` to the component when no accessible
  locator exists. Avoid CSS selectors and positional picks such as `.first()` on
  seed data.
- Each journey creates its own data (through the API client or UI) instead of
  depending on whichever client the seed happens to list first. Use unique names
  and clean up where the API allows.
- Assert outcomes the user cares about: the URL, the visible record, the
  displayed money amounts, the toast. Money is asserted as displayed strings
  such as `150,000.00`.
- Never use fixed `waitForTimeout`. Wait on locators or responses
  (`page.waitForResponse`).

## 3. Smoke navigation check
For every route reachable from the sidebar:
1. Visit the page.
2. Fail on any `console.error`, any `pageerror`, any API response with status
   400 or above, and any rendered error boundary or not-found component.
3. Confirm a heading or key landmark renders.

Collect console and response failures with `page.on("console")`,
`page.on("pageerror")`, and `page.on("response")` in a shared fixture so every
spec benefits.

## 4. Core journeys to keep covered
- Create client, issue a policy, view the risk note (products that use one).
- Medical policy issuance, with no risk note produced.
- Invoice, record payment, allocate, check the outstanding balance.
- Renewal state transitions.
- Catalog browsing (insurers and products).

## 5. Reporting
Report which journeys ran, pass or fail, and for failures include the failing
assertion, the page URL, and any console or network errors captured. Do not
mark a flaky test as skipped; find the missing wait or the data dependency.

## 6. Independent QA
For a broad pass, delegate to a QA subagent with the prompt in
[references/qa-prompt.md](references/qa-prompt.md).
