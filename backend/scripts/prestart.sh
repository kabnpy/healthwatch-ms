#! /usr/bin/env bash

set -e
set -x

if [ -d ".venv/bin" ]; then
    export PATH=".venv/bin:$PATH"
fi

# Let the DB start
python app/backend_pre_start.py

# Schema setup: either auto-create tables directly via SQLModel or run Alembic migrations
if [ "${AUTO_CREATE_TABLES}" = "true" ]; then
    echo "AUTO_CREATE_TABLES is true. Creating tables directly from SQLModel metadata..."
    python -c "from app.core.db import engine; from sqlmodel import SQLModel; SQLModel.metadata.create_all(engine)"
else
    echo "Running Alembic migrations..."
    alembic upgrade head
fi

# Create initial data in DB
python app/initial_data.py
