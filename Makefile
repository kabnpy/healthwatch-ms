.PHONY: help dev up down restart logs ps test test-backend test-frontend lint format client migrate seed clean

help:
	@echo "HealthWatch MS - Task Runner"
	@echo "----------------------------"
	@echo "make dev           - Start full dev stack with docker compose watch"
	@echo "make up            - Start containers in background (docker compose up -d)"
	@echo "make down          - Stop and remove containers"
	@echo "make restart       - Restart containers"
	@echo "make logs          - Tail logs from all containers"
	@echo "make test          - Run backend & frontend tests"
	@echo "make test-backend  - Run backend pytest suite"
	@echo "make test-frontend - Run frontend test suite"
	@echo "make lint          - Run Ruff and Biome linting"
	@echo "make format        - Run Ruff and Biome formatting"
	@echo "make client        - Regenerate OpenAPI client from backend"
	@echo "make migrate       - Run Alembic database migrations"
	@echo "make seed          - Seed mock database"
	@echo "make clean         - Clean pycache and build artifacts"

dev:
	docker compose watch

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

test-backend:
	cd backend && (uv run pytest -q || ./.venv/bin/pytest -q)

test-frontend:
	cd frontend && bun run test

test: test-backend test-frontend

lint:
	cd backend && (uv run ruff check . || ./.venv/bin/ruff check .)
	cd frontend && bun run lint

format:
	cd backend && (uv run ruff format . || ./.venv/bin/ruff format .)
	cd frontend && bun run lint

client:
	cd frontend && bun run generate-client

migrate:
	cd backend && (uv run alembic upgrade head || ./.venv/bin/alembic upgrade head)

seed:
	cd backend && (uv run python app/seed_mock_data.py || ./.venv/bin/python app/seed_mock_data.py)

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/dist
