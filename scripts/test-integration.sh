#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(supabase status -o env)"
export SUPABASE_TEST_URL="$API_URL"
export SUPABASE_TEST_ANON_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"
export SUPABASE_TEST_DB_URL="$DB_URL"
exec pnpm exec jest -c jest.integration.config.cjs --runInBand "$@"
