#!/usr/bin/env bash
# Rehearse one merchant's restore into a fresh database in the disposable CI service.
set -euo pipefail

[[ ${CI:-} == true && ${NODE_ENV:-} == development ]]
container=${1:?Pass the disposable PostgreSQL 16 service container}
[[ $(docker inspect --format '{{.Config.Image}}' "$container") == postgres:16-alpine ]]

a=shqipshop_ci_a
b=shqipshop_ci_b
target=shqipshop_ci_a_restore

pg() {
  local role=$1 database=$2 password=$3
  shift 3
  docker exec -i -e "PGPASSWORD=$password" "$container" \
    psql -X --no-password --quiet --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --host 127.0.0.1 --username "$role" --dbname "$database" "$@"
}

assert_fixture() {
  local role=$1 password=$2
  [[ $(pg "$role" "$role" "$password" <<'SQL'
SELECT EXISTS (
  SELECT 1 FROM "order" o
  JOIN order_payment_collection op ON op.order_id = o.id
  JOIN payment p ON p.payment_collection_id = op.payment_collection_id
  WHERE o.currency_code = 'all' AND p.currency_code = 'all'
    AND p.provider_id = 'pp_system_default' AND p.amount > 0
) AND EXISTS (SELECT 1 FROM inventory_level) AND EXISTS (SELECT 1 FROM image);
SQL
  ) == t ]]
}

fingerprint() {
  pg "$@" <<'SQL' | sha256sum
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT format('SELECT %L, to_jsonb(row) FROM public.%I row ORDER BY row.id', name, name)
FROM unnest(ARRAY[
  'product', 'product_variant', 'image', 'product_variant_product_image',
  'inventory_item', 'inventory_level', 'reservation_item',
  'order', 'order_cart', 'order_item', 'order_line_item', 'order_line_item_adjustment',
  'order_summary', 'order_payment_collection', 'payment_collection',
  'payment_session', 'payment', 'capture', 'refund'
]) WITH ORDINALITY AS relations(name, position)
ORDER BY position
\gexec
COMMIT;
SQL
}

assert_fixture "$a" merchantA_disposable
assert_fixture "$b" merchantB_disposable
before_a=$(fingerprint "$a" "$a" merchantA_disposable)
before_b=$(fingerprint "$b" "$b" merchantB_disposable)
[[ "$before_a" != "$before_b" ]]

# Never overwrite an existing target or restore into either live fixture.
pg medusa_ci postgres disposable_ci_password \
  --command "CREATE DATABASE $target OWNER $a TEMPLATE template0 ALLOW_CONNECTIONS false"
cleanup() {
  pg medusa_ci postgres disposable_ci_password --command "DROP DATABASE $target"
}
trap cleanup EXIT
pg medusa_ci postgres disposable_ci_password \
  --command "REVOKE CONNECT ON DATABASE $target FROM PUBLIC" \
  --command "ALTER DATABASE $target ALLOW_CONNECTIONS true"

# Keep the archive in a pipe inside the disposable runner. Do not upload it or log rows.
docker exec -e PGPASSWORD=merchantA_disposable "$container" \
  pg_dump --no-password --host 127.0.0.1 --username "$a" --format custom "$a" |
  docker exec -i -e PGPASSWORD=merchantA_disposable "$container" \
    pg_restore --no-password --host 127.0.0.1 --username "$a" --dbname "$target" \
      --no-owner --no-privileges --single-transaction --exit-on-error

[[ $(fingerprint "$a" "$target" merchantA_disposable) == "$before_a" ]]
[[ $(fingerprint "$a" "$a" merchantA_disposable) == "$before_a" ]]
[[ $(fingerprint "$b" "$b" merchantB_disposable) == "$before_b" ]]
if pg "$b" "$target" merchantB_disposable --command 'SELECT 1' >/dev/null 2>&1; then
  echo 'Merchant B connected to the restored merchant A database' >&2
  exit 1
fi

echo 'SHQIPSHOP_MERCHANT_A_PG_RESTORE_FINANCE_STOCK_IMAGE_REFERENCES_AND_B_ISOLATION_PASSED'
