# HealthWatch MS - Frontend

React 19 + TypeScript + Vite 8 frontend built with Bun, TanStack Query v5, TanStack Router, Tailwind CSS v4, and `shadcn/ui`.

For local startup, backing services, and workspace commands (`bun run dev`, `bun run test:frontend`, `bun run typecheck`, `bun run lint`), see [`../development.md`](../development.md).

## Code Structure

- `src/client/`: Auto-generated OpenAPI TypeScript client (**never hand-edit**; regenerate via `bun run client` after backend schema changes).
- `src/hooks/`: TanStack Query v5 data-fetching hooks (unwrap `.data` inside hooks before returning to components).
- `src/components/`: UI primitives (`components/ui/`) and domain components.
- `src/routes/`: File-based TanStack Router pages.
- `src/index.css`: Tailwind CSS v4 theme and OKLCH design tokens.

See [`../docs/02_design_system.md`](../docs/02_design_system.md) and [`../CODING_STANDARDS.md`](../CODING_STANDARDS.md) for UI, typography, and component standards.

## Remote API Configuration

To point the local Vite dev server at a remote API, set `VITE_API_URL` in `frontend/.env` (untracked):

```env
VITE_API_URL=https://api.example.com
```

## Testing

- **Unit & component tests (preferred locally):** `bun run test:frontend` (Vitest)
- **End-to-end tests:** `bun run test:e2e` (Playwright)
