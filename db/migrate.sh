#!/usr/bin/env bash
# Forward-only SQL migrations with psql. See db/README.md.
#
#   db/migrate.sh             apply pending migrations
#   db/migrate.sh --dry-run   list pending migrations, change nothing
#   db/migrate.sh --status    list applied and pending migrations
#
# Connection: MIGRATION_DATABASE_URL, falling back to DATABASE_URL.
# Files:      $MIGRATIONS_DIR (default: db/migrations), named NNNN_short_name.sql.
#
# Exit codes: 0 success, 1 migration or database error, 2 usage or setup error.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$SCRIPT_DIR/migrations}"
DB_URL="${MIGRATION_DATABASE_URL:-${DATABASE_URL:-}}"
# Any constant works; every run of this script must use the same one.
LOCK_KEY=727465686572
MODE=apply

log() { printf 'migrate: %s\n' "$*"; }
fail() {
  printf 'migrate: ERROR: %s\n' "$1" >&2
  exit "${2:-2}"
}

usage() {
  sed -n '2,11p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE=dry-run ;;
    --status) MODE=status ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "unknown argument: $arg"
      ;;
  esac
done

[ -n "$DB_URL" ] || fail "set MIGRATION_DATABASE_URL or DATABASE_URL"
command -v psql >/dev/null || fail "psql not found (run this script inside the postgres image)"
[ -d "$MIGRATIONS_DIR" ] || fail "migrations directory not found: $MIGRATIONS_DIR"

checksum() {
  if command -v sha256sum >/dev/null; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

export PGAPPNAME=migrate
psql_run() { psql "$DB_URL" --no-psqlrc --quiet -v ON_ERROR_STOP=1 "$@"; }

# --- collect local files -----------------------------------------------------
VERSIONS=()
NAMES=()
FILES=()
SUMS=()
while IFS= read -r file; do
  base="$(basename "$file")"
  [[ "$base" =~ ^([0-9]{4})_([a-z0-9_]+)\.sql$ ]] ||
    fail "bad file name '$base' (expected NNNN_short_name.sql, lower case)"
  version="${BASH_REMATCH[1]}"
  for seen in "${VERSIONS[@]+"${VERSIONS[@]}"}"; do
    [ "$seen" != "$version" ] || fail "duplicate migration version $version"
  done
  [[ "$file" != *"'"* ]] || fail "migration path must not contain a quote: $file"
  VERSIONS+=("$version")
  NAMES+=("${BASH_REMATCH[2]}")
  FILES+=("$file")
  SUMS+=("$(checksum "$file")")
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)

# --- read-only modes -----------------------------------------------------------
applied_rows() {
  local exists
  exists="$(psql_run -At -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL")" ||
    fail "cannot connect to the database" 1
  [ "$exists" = "t" ] || return 0
  psql_run -At -F '|' -c \
    "SELECT version, name, checksum, to_char(applied_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
       FROM public.schema_migrations ORDER BY version"
}

report() {
  local rows pending=0 changed=0 i row version name sum at
  rows="$(applied_rows)"
  [ "$MODE" = "status" ] && printf '%-8s %-40s %-9s %s\n' VERSION NAME STATE APPLIED_AT
  for i in "${!VERSIONS[@]}"; do
    version="${VERSIONS[$i]}"
    row="$(grep "^${version}|" <<<"$rows" || true)"
    if [ -z "$row" ]; then
      pending=$((pending + 1))
      if [ "$MODE" = "status" ]; then
        printf '%-8s %-40s %-9s\n' "$version" "${NAMES[$i]}" pending
      else
        log "pending ${version}_${NAMES[$i]}.sql"
      fi
      continue
    fi
    IFS='|' read -r _ name sum at <<<"$row"
    if [ "$sum" != "${SUMS[$i]}" ] || [ "$name" != "${NAMES[$i]}" ]; then
      changed=$((changed + 1))
      log "CHANGED ${version}_${NAMES[$i]}.sql differs from the applied version (${version}_${name})" >&2
    fi
    [ "$MODE" = "status" ] && printf '%-8s %-40s %-9s %s\n' "$version" "${NAMES[$i]}" applied "$at"
  done
  while IFS='|' read -r version name _ at; do
    [ -n "$version" ] || continue
    if ! printf '%s\n' "${VERSIONS[@]+"${VERSIONS[@]}"}" | grep -qx "$version"; then
      log "WARNING ${version}_${name} is applied but its file is missing" >&2
    fi
  done <<<"$rows"
  log "$pending pending"
  [ "$changed" -eq 0 ] || exit 1
}

if [ "$MODE" != "apply" ]; then
  report
  exit 0
fi

# --- apply -----------------------------------------------------------------------
# One psql session: the advisory lock is held from the first check to the last file.
# Each pending file runs in its own transaction; on error psql stops (ON_ERROR_STOP) and
# the open transaction is rolled back.
script="$(mktemp)"
trap 'rm -f "$script"' EXIT

{
  echo "SET client_min_messages = warning;"
  echo "SELECT pg_advisory_lock($LOCK_KEY) \\g /dev/null"
  cat <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version    text PRIMARY KEY,
  name       text,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
  # Pass 1: every applied file must be unchanged before anything new runs.
  for i in "${!VERSIONS[@]}"; do
    v="${VERSIONS[$i]}" n="${NAMES[$i]}" s="${SUMS[$i]}"
    cat <<SQL
SELECT coalesce(bool_and(checksum = '$s' AND name = '$n'), true) AS unchanged
  FROM public.schema_migrations WHERE version = '$v' \\gset
\\if :unchanged
\\else
DO \$\$ BEGIN RAISE EXCEPTION 'migration ${v}_${n}.sql was changed after it was applied (checksum mismatch). Applied migrations must never be edited: add a new migration instead.'; END \$\$;
\\endif
SQL
  done
  echo "SELECT 0 AS applied_count \\gset"
  # Pass 2: apply pending files in order.
  for i in "${!VERSIONS[@]}"; do
    v="${VERSIONS[$i]}" n="${NAMES[$i]}" s="${SUMS[$i]}" f="${FILES[$i]}"
    in_tx=true
    if head -n 5 "$f" | grep -qi -- '-- migrate:no-transaction'; then in_tx=false; fi
    echo "SELECT count(*) > 0 AS is_applied FROM public.schema_migrations WHERE version = '$v' \\gset"
    echo "\\if :is_applied"
    echo "\\else"
    echo "\\echo 'migrate: applying ${v}_${n}.sql'"
    $in_tx && echo "BEGIN;"
    echo "\\o /dev/null"
    echo "\\i '$f'"
    echo "\\o"
    echo "INSERT INTO public.schema_migrations (version, name, checksum) VALUES ('$v', '$n', '$s');"
    $in_tx && echo "COMMIT;"
    echo "SELECT :applied_count + 1 AS applied_count \\gset"
    echo "\\endif"
  done
  echo "SELECT pg_advisory_unlock($LOCK_KEY) \\g /dev/null"
  echo "\\echo 'migrate:' :applied_count 'migration(s) applied'"
} >"$script"

if ! psql_run -f "$script"; then
  fail "stopped; the failing migration was rolled back and nothing after it ran" 1
fi
