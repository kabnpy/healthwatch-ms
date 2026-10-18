#!/usr/bin/env bash

set -e
set -x

COVERAGE_BIN="coverage"
if ! command -v coverage &> /dev/null; then
    if [ -f "./.venv/bin/coverage" ]; then
        COVERAGE_BIN="./.venv/bin/coverage"
    elif [ -f "../backend/.venv/bin/coverage" ]; then
        COVERAGE_BIN="../backend/.venv/bin/coverage"
    elif command -v uv &> /dev/null; then
        COVERAGE_BIN="uv run coverage"
    fi
fi

$COVERAGE_BIN run -m pytest tests/ "$@"
$COVERAGE_BIN report
$COVERAGE_BIN html --title "${@-coverage}"
