#!/usr/bin/env bash
# Use only the fresh service and synthetic data provisioned by this workflow.
set -euo pipefail
[[ ${CI:-} == true ]]
mode=${1:?Pass source or restore}
container=${2:?Pass the isolated PostgreSQL service ID}
[[ $(docker inspect --format '{{.Config.Image}}' "$container") == postgres:16-alpine ]]
cd "$(dirname "${BASH_SOURCE[0]}")/.."
work=$(mktemp -d)
umask 077
media="$PWD/apps/backend/static/medusa-restore-fixture.png"
test ! -e "$media"
mkdir -p "$(dirname "$media")"
api=
stage=setup
cleanup() {
  local status=$1
  if (( status != 0 )); then
    printf "Runtime recovery failed at %s (exit %s)\n" "$stage" "$status" >&2
  fi
  if [[ -n "$api" ]]; then
    kill -TERM -- "-$api" 2>/dev/null || true
    wait "$api" 2>/dev/null || true
  fi
  rm -f -- "$media"
  rm -rf -- "$work"
}
trap 'cleanup "$?"' EXIT

export NODE_ENV=development SHQIPSHOP_REQUIRE_REDIS=true WORKER_MODE=server
export DATABASE_URL=postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_restore_fixture
export REDIS_URL=redis://127.0.0.1:6379
export JWT_SECRET="$(openssl rand -hex 32)" COOKIE_SECRET="$(openssl rand -hex 32)"
export STORE_CORS=http://localhost:8000 ADMIN_CORS=http://localhost:9000 AUTH_CORS=http://localhost:9000
export SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE="$work/store-key"
export SHQIPSHOP_CI_EMPTY_CHANNEL_KEY_FILE="$work/empty-key"
export SHQIPSHOP_CI_ORDER_ID_FILE="$work/order"
export SHQIPSHOP_CI_CART_ID_FILE="$work/cart"

pg() { docker exec -i "$container" psql -XAtq -v ON_ERROR_STOP=1 -U medusa_ci "$@"; }
fixture_pg() { pg -d medusa_restore_fixture "$@"; }
medusa() { pnpm --filter @dtc/backend exec medusa "$@"; }
digest() { sha256sum "$1" | cut -d' ' -f1; }
boot_digest() { digest /proc/sys/kernel/random/boot_id; }

start_api() {
  setsid pnpm --filter @dtc/backend exec medusa develop --host 127.0.0.1 --port 9000 >"$work/api.log" 2>&1 &
  api=$!
  for _ in $(seq 1 60); do
    if curl -fsS --max-time 2 http://127.0.0.1:9000/health >/dev/null 2>&1; then return; fi
    kill -0 "$api"
    sleep 2
  done
  echo '::error::Disposable Medusa API did not become ready'
  return 1
}

order_digest() {
  local order_id=$1
  fixture_pg --set "order_id=$order_id" < scripts/export-merchant-order-fixture.sql |
    node scripts/verify-merchant-order-fixture.mjs "$order_id"
}

# Never send fixture requests to an API that was already listening.
if curl -s --max-time 2 http://127.0.0.1:9000/health >/dev/null; then
  echo '::error::Port 9000 already serves HTTP' >&2
  exit 1
fi

case "$mode" in
  source)
    [[ "$(fixture_pg -c "SELECT NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public')")" == t ]]
    stage=source-migrations
    medusa db:migrate >"$work/migration.log" 2>&1
    stage=source-key
    medusa exec ./src/scripts/export-ci-publishable-key.ts >"$work/keys.log" 2>&1
    base64 -d >"$media" <<'PNG'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=
PNG
    stage=source-media
    medusa exec ./src/scripts/cross-runner-runtime-fixture-ci.ts >"$work/media.log" 2>&1
    stage=source-api
    start_api
    stage=source-checkout
    node scripts/store-api-checkout.mjs
    [[ "$(fixture_pg -c "SELECT (SELECT count(*) FROM \"order\")=1 AND NOT EXISTS(SELECT 1 FROM auth_identity)
      AND NOT EXISTS (SELECT 1 FROM \"user\") AND NOT EXISTS (SELECT 1 FROM payment WHERE provider_id <> 'pp_system_default')
      AND NOT EXISTS (SELECT 1 FROM customer WHERE email IS NOT NULL AND email NOT LIKE '%@example.invalid')")" == t ]]
    stage=source-backup
    order_digest "$(< "$work/order")" >"$work/order.sha256"
    cp "$media" "$work/image.png"
    docker exec "$container" pg_dump -U medusa_ci --no-owner --no-privileges \
      --exclude-table-data='public.auth*' --exclude-table-data='public.api_key' \
      --exclude-table-data='public.publishable_api_key_sales_channel' \
      --exclude-table-data='public.user*' --exclude-table-data='public.invite*' \
      --exclude-table-data='public.*webhook*' medusa_restore_fixture >"$work/postgres.sql"
    for input in "$work/store-key" "$work/empty-key"; do
      if grep -Fq -f "$input" "$work/postgres.sql"; then exit 1; fi
    done
    for secret in "$JWT_SECRET" "$COOKIE_SECRET"; do
      if grep -Fq -- "$secret" "$work/postgres.sql"; then exit 1; fi
    done
    tar -C "$work" -czf "$work/fixture.tgz" postgres.sql image.png order.sha256
    [[ "$(wc -c <"$work/fixture.tgz")" -le 65536 ]]
    {
      printf 'boot=%s\n' "$(boot_digest)"
      printf 'sha256=%s\n' "$(digest "$work/fixture.tgz")"
      printf 'archive=%s\n' "$(base64 -w0 "$work/fixture.tgz")"
    } >>"${GITHUB_OUTPUT:?}"
    echo 'SHQIPSHOP_SANITIZED_MEDUSA_ARCHIVE_READY'
    ;;
  restore)
    stage=verify-transfer
    [[ ${SOURCE_BOOT:?} =~ ^[0-9a-f]{64}$ && "$SOURCE_BOOT" != "$(boot_digest)" ]]
    [[ ${ARCHIVE_SHA:?} =~ ^[0-9a-f]{64}$ && ${#ARCHIVE_BASE64} -le 87384 ]]
    printf '%s' "${ARCHIVE_BASE64:?}" | base64 -d >"$work/fixture.tgz"
    [[ "$(digest "$work/fixture.tgz")" == "$ARCHIVE_SHA" ]]
    [[ "$(tar -tzf "$work/fixture.tgz")" == $'postgres.sql\nimage.png\norder.sha256' ]]
    tar -xOzf "$work/fixture.tgz" image.png >"$media"
    tar -xOzf "$work/fixture.tgz" postgres.sql >"$work/postgres.sql"
    tar -xOzf "$work/fixture.tgz" order.sha256 >"$work/order.sha256"
    pg -d postgres -c 'CREATE ROLE restore_neighbor NOLOGIN' -c 'CREATE DATABASE restore_neighbor'
    pg -d restore_neighbor -c "CREATE TABLE fixture (value text); INSERT INTO fixture VALUES ('merchant-b');"
    pg -d postgres -c 'REVOKE CONNECT ON DATABASE medusa_restore_fixture FROM PUBLIC'
    [[ "$(fixture_pg -c "SELECT NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public')")" == t ]]
    stage=restore-postgres
    fixture_pg --single-transaction <"$work/postgres.sql" >/dev/null
    [[ "$(fixture_pg -c 'SELECT count(*) FROM order_cart')" == 1 ]]
    order=$(fixture_pg -c 'SELECT order_id FROM order_cart')
    cart=$(fixture_pg -c 'SELECT cart_id FROM order_cart')
    stage=restore-order-digest
    [[ "$(order_digest "$order")" == "$(< "$work/order.sha256")" ]]
    stage=restore-key
    # Medusa boot generates an initial publishable key when none is present.
    # Assert the archive omitted credentials before any Medusa command runs.
    [[ "$(fixture_pg -c 'SELECT NOT EXISTS (SELECT 1 FROM api_key)
      AND NOT EXISTS (SELECT 1 FROM publishable_api_key_sales_channel)
      AND NOT EXISTS (SELECT 1 FROM auth_identity)
      AND NOT EXISTS (SELECT 1 FROM "user")')" == t ]]
    medusa exec ./src/scripts/export-ci-publishable-key.ts >"$work/keys.log" 2>&1
    stage=restore-api
    start_api
    stage=restore-http
    node scripts/read-restored-medusa-fixture.mjs "$order" "$cart" "$media"
    stage=restore-neighbor
    [[ "$(pg -d restore_neighbor -c 'SELECT value FROM fixture')" == merchant-b ]]
    [[ "$(pg -d postgres -c "SELECT has_database_privilege('restore_neighbor','medusa_restore_fixture','CONNECT')")" == f ]]
    echo 'SHQIPSHOP_SEPARATE_RUNNER_MEDUSA_RUNTIME_RESTORED'
    ;;
  *) exit 2 ;;
esac
