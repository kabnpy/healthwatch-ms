# Stage 1: Build Frontend SPA
FROM oven/bun:1 AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock /app/frontend/
RUN bun install --frozen-lockfile

COPY ./frontend /app/frontend
ARG VITE_API_URL=
RUN bun run build

# Stage 2: Python Backend with Embedded Frontend
FROM python:3.14

ENV PYTHONUNBUFFERED=1

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /uvx /bin/

# Place executables in the environment at the front of the path
ENV PATH="/app/.venv/bin:$PATH"

# Compile bytecode
ENV UV_COMPILE_BYTECODE=1

# uv Cache
ENV UV_LINK_MODE=copy

WORKDIR /app/

# Install backend dependencies
COPY ./backend/pyproject.toml ./backend/uv.lock /app/
RUN uv sync --frozen --no-install-project

COPY ./backend/scripts /app/scripts
COPY ./backend/alembic.ini /app/
COPY ./backend/app /app/app
COPY ./backend/tests /app/tests

# Copy built frontend assets from Stage 1 into backend app/frontend
COPY --from=frontend-build /app/backend/app/frontend /app/app/frontend

# Sync the project
RUN uv sync --frozen

CMD ["fastapi", "run", "--workers", "4", "app/main.py"]
