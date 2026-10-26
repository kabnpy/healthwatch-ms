---
name: client-regen
description: >-
  Regenerate openapi.json and the TypeScript API client after backend route or
  schema changes, then fix frontend types. Use whenever a Pydantic schema, route,
  or response model changes.
---

# Regenerate the API Client

The frontend client in `frontend/src/client/` is generated. Never edit it by hand.

## Steps
1. Finish the backend change and make its tests pass (`./run test:backend`).
2. Regenerate from the worktree root:
   ```bash
   bash scripts/generate-client.sh
   ```
   This writes `frontend/openapi.json` from the backend app, then runs
   `openapi-ts` to rebuild `frontend/src/client/`. `./run client` regenerates the
   TypeScript client from an existing `openapi.json` only.
3. Type-check and lint:
   ```bash
   cd frontend && bun x tsc -p tsconfig.build.json
   cd .. && ./run lint
   ```
4. Fix every type error in hooks and components. Unwrap `.data` in the hook, not
   in components.
5. Update affected Playwright specs and run them (see `qa-journey`).
6. Commit the backend change, the regenerated client, and the frontend fixes
   together so no commit leaves the build broken.

## Rules
- Only one task at a time should regenerate the client. If another worktree has
  changed schemas, merge it first, then regenerate; never hand-merge generated
  files.
- A diff in `src/client/` with no matching backend change means the generator or
  its inputs drifted. Investigate before committing.
