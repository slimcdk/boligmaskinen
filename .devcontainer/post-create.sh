#!/usr/bin/env bash
# Runs once when the dev container is created: the dependencies of every part of the project
set -euo pipefail
cd "$(dirname "$0")/.."

(cd packages/engine && npm ci)
(cd frontend && npm ci && npx playwright install chromium)
(cd backend && npm ci)
(cd pilot && uv sync)
