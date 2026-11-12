#!/usr/bin/env bash
# Roda migrations + testes pgTAP em um Postgres comum (sem Docker), usando o
# shim que emula os objetos do Supabase. Uso:
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/test-db.sh
# Com a Supabase CLI e Docker disponíveis, prefira `supabase test db`.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-paidabartira_test}"

psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null; }

run supabase/tests/support/supabase_shim.sql
for f in supabase/migrations/*.sql; do run "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -c "create extension if not exists pgtap with schema extensions" >/dev/null

status=0
for t in supabase/tests/database/*.test.sql; do
  echo "== $t"
  out="$(psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$DB" -f "$t" 2>&1)" || { echo "$out"; status=1; continue; }
  echo "$out" | grep -E "^(not ok|#)" || true
  total="$(echo "$out" | grep -cE "^ok " || true)"
  failed="$(echo "$out" | grep -cE "^not ok " || true)"
  echo "   ok: ${total}  falhas: ${failed}"
  if [ "$failed" != "0" ] || echo "$out" | grep -q "Looks like"; then status=1; fi
done
exit $status
