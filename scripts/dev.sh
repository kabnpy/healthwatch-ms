#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$ROOT_DIR"

if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "==> Created .env from .env.example"
fi

detect_compose() {
  if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    echo "podman compose"
  elif command -v podman-compose >/dev/null 2>&1; then
    echo "podman-compose"
  elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
}

require_compose() {
  local compose_cmd
  compose_cmd="$(detect_compose)"
  if [ -z "$compose_cmd" ]; then
    echo "Error: Neither podman compose nor docker compose found." >&2
    exit 1
  fi
  echo "$compose_cmd"
}

run_backend() {
  (
    cd "$ROOT_DIR/backend"
    if command -v uv >/dev/null 2>&1; then
      uv run "$@"
    elif [ -f ".venv/bin/$1" ]; then
      local c="$1"
      shift
      "./.venv/bin/$c" "$@"
    else
      "$@"
    fi
  )
}

is_db_ready() {
  run_backend python -c "import socket; s = socket.socket(); s.settimeout(1); res = s.connect_ex(('127.0.0.1', 5432)); exit(res)" 2>/dev/null
}

start_db_if_needed() {
  if is_db_ready; then
    return 0
  fi

  local compose_cmd
  compose_cmd="$(require_compose)"

  echo "==> Starting database and mailpit via $compose_cmd..."
  $compose_cmd up -d db mailpit

  echo "==> Waiting for database on port 5432..."
  local retries=25
  while ! is_db_ready; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then
      echo "Error: Database did not become ready within timeout." >&2
      exit 1
    fi
    sleep 1
  done
  echo "==> Database is ready."
}

mode="${1:-all}"
shift 2>/dev/null || true

case "$mode" in
  db:up)
    start_db_if_needed
    ;;
  up)
    compose_cmd="$(require_compose)"
    if [ "$#" -eq 0 ]; then
      $compose_cmd up -d db mailpit
    else
      $compose_cmd up -d "$@"
    fi
    ;;
  down)
    compose_cmd="$(require_compose)"
    $compose_cmd down "$@"
    ;;
  logs)
    compose_cmd="$(require_compose)"
    $compose_cmd logs -f "$@"
    ;;
  backend)
    start_db_if_needed
    run_backend fastapi dev app/main.py --port 8000
    ;;
  frontend)
    cd "$ROOT_DIR/frontend" && bun run dev
    ;;
  status)
    compose_cmd="$(detect_compose)"
    echo "Container runtime : ${compose_cmd:-none detected}"
    is_db_ready && echo "PostgreSQL (5432) : RUNNING" || echo "PostgreSQL (5432) : STOPPED"
    curl -s -f http://localhost:8000/api/v1/utils/system-info >/dev/null 2>&1 && echo "Backend API (8000): RUNNING" || echo "Backend API (8000): STOPPED"
    curl -s -f http://localhost:5173/ >/dev/null 2>&1 && echo "Frontend (5173)   : RUNNING" || echo "Frontend (5173)   : STOPPED"
    ;;
  *)
    start_db_if_needed
    echo "==> Running database migrations..."
    run_backend alembic upgrade head
    echo "==> Ensuring initial data exists..."
    run_backend python app/initial_data.py

    cleanup() {
      if [ -n "$BACKEND_PID" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
      if [ -n "$FRONTEND_PID" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
      wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM

    (run_backend fastapi dev app/main.py --port 8000) &
    BACKEND_PID=$!
    (cd "$ROOT_DIR/frontend" && bun run dev) &
    FRONTEND_PID=$!
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    ;;
esac
