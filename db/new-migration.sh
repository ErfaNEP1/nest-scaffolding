#!/usr/bin/env bash
# Creates the next numbered migration file.
#
#   db/new-migration.sh add_customer_email
#   pnpm db:new add_customer_email
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$SCRIPT_DIR/migrations}"

name="${1:-}"
if [ -z "$name" ]; then
  echo "usage: db/new-migration.sh <short_name>" >&2
  exit 2
fi
name="$(printf '%s' "$name" | tr '[:upper:] -' '[:lower:]__' | tr -cd 'a-z0-9_')"
[ -n "$name" ] || {
  echo "new-migration: name must contain letters or digits" >&2
  exit 2
}

mkdir -p "$MIGRATIONS_DIR"
last="$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '[0-9][0-9][0-9][0-9]_*.sql' -exec basename {} \; |
  LC_ALL=C sort | tail -n 1 | cut -c1-4)"
next="$(printf '%04d' $((10#${last:-0} + 1)))"
file="$MIGRATIONS_DIR/${next}_${name}.sql"

author="$(git config user.name 2>/dev/null || echo "${USER:-unknown}")"
cat >"$file" <<EOF
-- Migration: ${next}_${name}
-- Purpose:   TODO describe the one logical change this migration makes
-- Author:    ${author}
-- Date:      $(date -u +%Y-%m-%d)
--
-- Runs in its own transaction. For statements that cannot run in a transaction
-- (CREATE INDEX CONCURRENTLY), put "-- migrate:no-transaction" in the first 5 lines.
-- Never edit this file after it has been applied anywhere; add a new migration instead.

EOF
echo "$file"
