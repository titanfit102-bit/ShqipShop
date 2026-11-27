#!/usr/bin/env bash
# CI-only PostgreSQL and file transfer with a bounded, entirely synthetic archive.
set -euo pipefail
[[ ${CI:-} == true ]]
mode=${1:?Use source or restore}
container=${2:?Supply the isolated PostgreSQL service container}
[[ $(docker inspect --format '{{.Config.Image}}' "$container") == postgres:16-alpine ]]
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
umask 077

pg() { docker exec -i "$container" psql -XAtq -v ON_ERROR_STOP=1 -U postgres "$@"; }
digest() { sha256sum "$1" | cut -d' ' -f1; }
boot_digest() { digest /proc/sys/kernel/random/boot_id; }

seed() {
  local db=$1 order=$2 total=$3 media=$4
  pg -d postgres -c "CREATE DATABASE $db"
  pg -d "$db" <<SQL
CREATE TABLE stock (variant_id text PRIMARY KEY, quantity integer CHECK (quantity >= 0), image_sha256 text NOT NULL);
CREATE TABLE orders (order_id text PRIMARY KEY, variant_id text REFERENCES stock, currency text CHECK (currency = 'ALL'), total integer);
CREATE TABLE payments (order_id text PRIMARY KEY REFERENCES orders, amount integer, provider text CHECK (provider = 'simulated'));
INSERT INTO stock VALUES ('variant_fixture', 7, '$media');
INSERT INTO orders VALUES ('$order', 'variant_fixture', 'ALL', $total);
INSERT INTO payments VALUES ('$order', $total, 'simulated');
SQL
}

snapshot() {
  pg -d "$1" -c "SELECT o.order_id, o.currency, o.total, p.amount, p.provider, s.quantity, s.image_sha256
    FROM orders o JOIN payments p USING (order_id) JOIN stock s USING (variant_id) ORDER BY o.order_id"
}

case "$mode" in
  source)
    base64 -d > "$work/image.png" <<'PNG'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=
PNG
    seed fixture_a order_synthetic_a 1410 "$(digest "$work/image.png")"
    docker exec "$container" pg_dump -U postgres -Fc fixture_a > "$work/postgres.dump"
    tar -C "$work" -czf "$work/restore.tgz" postgres.dump image.png
    [[ $(wc -c < "$work/restore.tgz") -le 32768 ]]
    {
      printf 'source_boot=%s\n' "$(boot_digest)"
      printf 'sha256=%s\n' "$(digest "$work/restore.tgz")"
      printf 'archive=%s\n' "$(base64 -w0 "$work/restore.tgz")"
    } >> "${GITHUB_OUTPUT:?}"
    echo 'SHQIPSHOP_SYNTHETIC_CROSS_RUNNER_ARCHIVE_READY'
    ;;
  restore)
    [[ ${SOURCE_BOOT:?} =~ ^[0-9a-f]{64}$ && "$SOURCE_BOOT" != "$(boot_digest)" ]]
    [[ ${ARCHIVE_SHA:?} =~ ^[0-9a-f]{64}$ && ${#ARCHIVE_BASE64} -le 43692 ]]
    printf '%s' "${ARCHIVE_BASE64:?}" | base64 -d > "$work/restore.tgz"
    [[ "$(digest "$work/restore.tgz")" == "$ARCHIVE_SHA" ]]
    [[ "$(tar -tzf "$work/restore.tgz")" == $'postgres.dump\nimage.png' ]]
    tar -xOzf "$work/restore.tgz" postgres.dump > "$work/postgres.dump"
    tar -xOzf "$work/restore.tgz" image.png > "$work/image.png"
    seed fixture_b order_synthetic_b 990 "$(printf 'merchant b image' | sha256sum | cut -d' ' -f1)"
    before_b=$(snapshot fixture_b)
    pg -d postgres -c 'CREATE ROLE fixture_b_role NOLOGIN' -c 'CREATE DATABASE fixture_a_restored ALLOW_CONNECTIONS false'
    pg -d postgres -c 'REVOKE CONNECT ON DATABASE fixture_a_restored FROM PUBLIC' \
      -c 'ALTER DATABASE fixture_a_restored ALLOW_CONNECTIONS true'
    docker exec -i "$container" pg_restore -U postgres --dbname=fixture_a_restored \
      --single-transaction --no-owner --no-privileges --exit-on-error < "$work/postgres.dump"
    [[ "$(snapshot fixture_a_restored)" == "order_synthetic_a|ALL|1410|1410|simulated|7|$(digest "$work/image.png")" ]]
    [[ "$(snapshot fixture_b)" == "$before_b" ]]
    [[ "$(pg -d postgres -c "SELECT has_database_privilege('fixture_b_role','fixture_a_restored','CONNECT')")" == f ]]
    echo 'SHQIPSHOP_CROSS_RUNNER_POSTGRES_MEDIA_AND_MERCHANT_B_VERIFIED'
    ;;
  *) exit 2 ;;
esac
