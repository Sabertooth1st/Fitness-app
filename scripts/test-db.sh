#!/usr/bin/env bash
# Runs the Supabase migrations and RLS tests against a throwaway local PostgreSQL.
# Requires PostgreSQL binaries (initdb, pg_ctl, psql). Uses a Supabase auth shim;
# re-run against a real Supabase staging project before release.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUN=(runuser -u postgres --); fi
"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK" -l "$WORK/log" -w start >/dev/null
trap '"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null; rm -rf "$WORK"' EXIT
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_auth_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -t -A -f "$ROOT/supabase/tests/rls.test.sql" 2>&1 | grep -v '^$' | grep -v '^\[' | sed 's/^psql:[^ ]* NOTICE:  /  /'
