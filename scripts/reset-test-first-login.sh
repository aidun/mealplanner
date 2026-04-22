#!/bin/sh
set -eu

usage() {
  cat <<'EOF'
Usage: scripts/reset-test-first-login.sh <email> [namespace]

Resets a test account into the neutral first-login state for mealplanner-test:
- removes the saved family profile for the active family
- sets user_settings.profile_onboarding_seen = false

Safety rules:
- defaults to namespace mealplanner-test
- aborts if the account is missing
- aborts if the active family has more than one member
- aborts if migration 0013 is not present
EOF
}

if [ "${1:-}" = "" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

EMAIL="$1"
NAMESPACE="${2:-mealplanner-test}"

POD="$(kubectl -n "$NAMESPACE" get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')"
if [ -z "$POD" ]; then
  echo "Kein Postgres-Pod im Namespace $NAMESPACE gefunden." >&2
  exit 1
fi

kubectl -n "$NAMESPACE" exec "$POD" -- sh -lc '
set -eu

email="$1"
namespace="$2"

if ! psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select 1 from schema_migrations where version = 13" | grep -qx "1"; then
  echo "Migration 0013 fehlt im Cluster. Bitte zuerst den aktuellen Test-Stand ausrollen." >&2
  exit 1
fi

user_row="$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select u.id::text, coalesce(u.active_family_id::text, '\'''\''), (select count(*) from family_members fm where fm.family_id = u.active_family_id) from users u where lower(trim(u.email)) = lower('\''${email}'\'');")"
if [ -z "$user_row" ]; then
  echo "Kein User fuer ${email} gefunden." >&2
  exit 1
fi

user_id="$(printf "%s" "$user_row" | cut -d"|" -f1)"
family_id="$(printf "%s" "$user_row" | cut -d"|" -f2)"
member_count="$(printf "%s" "$user_row" | cut -d"|" -f3)"

if [ -z "$family_id" ]; then
  echo "User ${email} hat keine aktive Familie." >&2
  exit 1
fi

if [ "$member_count" -gt 1 ]; then
  echo "Abbruch: aktive Familie von ${email} hat ${member_count} Mitglieder. Kein automatischer Reset." >&2
  exit 1
fi

psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
DELETE FROM profiles WHERE family_id = '\''${family_id}'\''::uuid;
INSERT INTO user_settings(user_id, profile_onboarding_seen, updated_at)
VALUES ('\''${user_id}'\''::uuid, false, now())
ON CONFLICT (user_id) DO UPDATE
SET profile_onboarding_seen = false,
    updated_at = now();
COMMIT;
SQL

echo "Reset abgeschlossen fuer ${email} in ${namespace}."
' -- "$EMAIL" "$NAMESPACE"
