FROM python:3.14

ENV PYTHONUNBUFFERED=1

WORKDIR /app/

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

# Place executables in the environment at the front of the path
ENV PATH="/app/.venv/bin:$PATH"

# Compile bytecode
ENV UV_COMPILE_BYTECODE=1

# uv Cache
ENV UV_LINK_MODE=copy

ENV PYTHONPATH=/app

# Install dependencies
COPY pyproject.toml uv.lock /app/
RUN uv sync --frozen --no-install-project

COPY ./scripts /app/scripts
COPY ./alembic.ini /app/
COPY ./app /app/app
COPY ./tests /app/tests

# Sync the project
RUN uv sync

CMD ["sh", "-c", "bash scripts/prestart.sh && fastapi run --workers 4 --port 8000 app/main.py"]
