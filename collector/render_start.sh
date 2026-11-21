#!/usr/bin/env bash
# Caused Collector — Render Production Start Script
# Runs uvicorn with production-appropriate settings

set -e

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

echo "═══════════════════════════════════════════════════"
echo "  Caused Collector Backend — Starting on Render"
echo "  Host: $HOST | Port: $PORT"
echo "═══════════════════════════════════════════════════"

exec uvicorn main:app \
    --host "$HOST" \
    --port "$PORT" \
    --workers 1 \
    --log-level info \
    --timeout-keep-alive 120
