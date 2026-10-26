#! /usr/bin/env bash

set -e
set -x

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/backend"

if command -v uv >/dev/null 2>&1; then
  PYTHON_RUNNER="uv run python"
elif [ -f ".venv/bin/python" ]; then
  PYTHON_RUNNER=".venv/bin/python"
else
  PYTHON_RUNNER="python3"
fi

$PYTHON_RUNNER -c "import app.main; import json; print(json.dumps(app.main.app.openapi()))" > "$ROOT_DIR/frontend/openapi.json"
cd "$ROOT_DIR/frontend"

if command -v bun >/dev/null 2>&1; then
  bun run generate-client
else
  npm run generate-client
fi
