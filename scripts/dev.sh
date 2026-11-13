#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$ROOT_DIR"

detect_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
    echo "podman compose"
  elif command -v podman-compose >/dev/null 2>&1; then
    echo "podman-compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
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
    echo "==> Database is reachable on port 5432."
    return 0
  fi

  local compose_cmd
  compose_cmd="$(detect_compose)"
  if [ -z "$compose_cmd" ]; then
    echo "Error: Neither docker nor podman compose found, and database is not running on port 5432." >&2
    exit 1
  fi

  echo "==> Starting database and mailpit via $compose_cmd..."
  $compose_cmd up -d db mailpit

  echo "==> Waiting for database to accept connections..."
  local retries=20
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

case "$mode" in
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
