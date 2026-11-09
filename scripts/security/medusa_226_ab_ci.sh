#!/usr/bin/env bash
# Stage 12O: replay existing two-merchant order/JWT/cookie/mutation CI
# against the separately installed 2.22.6 candidate. Never deploy.
set -euo pipefail
if [[ "$CI" != "true" || "$NODE_ENV" != "development" ||
      "$SHQIPSHOP_MEDUSA_CANDIDATE_CI" != "true" ]]; then
  echo "::error::SHQIPSHOP_226_AB_CI_SCOPE_REJECTED"
  exit 1
fi
temp_dir="$(realpath "$RUNNER_TEMP")"
candidate_dir="$(realpath "$SHQIPSHOP_MEDUSA_CANDIDATE_DIR")"
case "$candidate_dir" in
  "$temp_dir"/*) ;;
  *) echo "::error::SHQIPSHOP_226_AB_CANDIDATE_OUTSIDE_RUNNER_TEMP"; exit 1 ;;
esac
cd "$candidate_dir"
node --check scripts/parallel-auth-boundary.mjs
node --check scripts/parallel-mutation-boundary.mjs
node --check scripts/parallel-merchant-boundary.mjs
node --test scripts/boundary-http.test.mjs

# All fixtures are synthetic; separate database users must be unable to
# connect to the other merchant's database.
command -v psql >/dev/null || {
  sudo apt-get update -qq
  sudo apt-get install -y postgresql-client
}
psql_ci() {
  PGPASSWORD=disposable_ci_password psql -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -U candidate_ci -d postgres "$@"
}
psql_ci -c "CREATE ROLE shqipshop_226_a LOGIN PASSWORD 'candidate_a_disposable';"
psql_ci -c "CREATE ROLE shqipshop_226_b LOGIN PASSWORD 'candidate_b_disposable';"
psql_ci -c "CREATE DATABASE shqipshop_226_a OWNER shqipshop_226_a;"
psql_ci -c "CREATE DATABASE shqipshop_226_b OWNER shqipshop_226_b;"
psql_ci -c "REVOKE CONNECT ON DATABASE shqipshop_226_a FROM PUBLIC;"
psql_ci -c "REVOKE CONNECT ON DATABASE shqipshop_226_b FROM PUBLIC;"
if PGPASSWORD=candidate_a_disposable psql -h 127.0.0.1 -U shqipshop_226_a \
  -d shqipshop_226_b -c 'SELECT 1' >/dev/null 2>&1; then
  echo "::error::SHQIPSHOP_226_DB_A_CROSSED_B"; exit 1
fi
if PGPASSWORD=candidate_b_disposable psql -h 127.0.0.1 -U shqipshop_226_b \
  -d shqipshop_226_a -c 'SELECT 1' >/dev/null 2>&1; then
  echo "::error::SHQIPSHOP_226_DB_B_CROSSED_A"; exit 1
fi
echo "SHQIPSHOP_226_AB_POSTGRES_ROLE_ISOLATION_PASSED"

db_a="postgres://shqipshop_226_a:candidate_a_disposable@127.0.0.1:5432/shqipshop_226_a"
db_b="postgres://shqipshop_226_b:candidate_b_disposable@127.0.0.1:5432/shqipshop_226_b"
redis_a="redis://127.0.0.1:6379"
redis_b="redis://127.0.0.1:6381"

# Every API/DB action below uses the frozen 2.22.6 RUNNER_TEMP copy.
export SHQIPSHOP_A_KEY_FILE="$RUNNER_TEMP/shqipshop226-a-key"
export SHQIPSHOP_B_KEY_FILE="$RUNNER_TEMP/shqipshop226-b-key"
export SHQIPSHOP_CHANNEL_A_FILE="$RUNNER_TEMP/shqipshop226-a-channel-key"
export SHQIPSHOP_CHANNEL_B_FILE="$RUNNER_TEMP/shqipshop226-b-channel-key"
export SHQIPSHOP_A_ORDER_FILE="$RUNNER_TEMP/shqipshop226-a-order"
export SHQIPSHOP_B_ORDER_FILE="$RUNNER_TEMP/shqipshop226-b-order"
export SHQIPSHOP_A_CART_FILE="$RUNNER_TEMP/shqipshop226-a-cart"
export SHQIPSHOP_B_CART_FILE="$RUNNER_TEMP/shqipshop226-b-cart"
export SHQIPSHOP_CI_SESSION_PROOF_FILE="$RUNNER_TEMP/shqipshop226-ab-session"

for merchant in A B; do
  if [[ "$merchant" == "A" ]]; then
    db="$db_a"; redis="$redis_a"
    key_file="$SHQIPSHOP_A_KEY_FILE"; channel_file="$SHQIPSHOP_CHANNEL_A_FILE"
  else
    db="$db_b"; redis="$redis_b"
    key_file="$SHQIPSHOP_B_KEY_FILE"; channel_file="$SHQIPSHOP_CHANNEL_B_FILE"
  fi
  DATABASE_URL="$db" REDIS_URL="$redis" \
    pnpm --filter @dtc/backend exec medusa db:migrate
  DATABASE_URL="$db" REDIS_URL="$redis" \
    pnpm --filter @dtc/backend exec medusa exec ./src/scripts/assert-albania-seed.ts
  DATABASE_URL="$db" REDIS_URL="$redis" \
    SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE="$key_file" \
    SHQIPSHOP_CI_EMPTY_CHANNEL_KEY_FILE="$channel_file" \
    pnpm --filter @dtc/backend exec medusa exec ./src/scripts/export-ci-publishable-key.ts
done

export SHQIPSHOP_A_ADMIN_PASSWORD="$(openssl rand -hex 24)"
export SHQIPSHOP_B_ADMIN_PASSWORD="$(openssl rand -hex 24)"
export SHQIPSHOP_A_CUSTOMER_PASSWORD="$(openssl rand -hex 24)"
export SHQIPSHOP_B_CUSTOMER_PASSWORD="$(openssl rand -hex 24)"
secret_a="$(openssl rand -hex 32)"
secret_b="$(openssl rand -hex 32)"
cookie_a="$(openssl rand -hex 32)"
cookie_b="$(openssl rand -hex 32)"
for secret in "$SHQIPSHOP_A_ADMIN_PASSWORD" "$SHQIPSHOP_B_ADMIN_PASSWORD" \
  "$SHQIPSHOP_A_CUSTOMER_PASSWORD" "$SHQIPSHOP_B_CUSTOMER_PASSWORD" \
  "$secret_a" "$secret_b" "$cookie_a" "$cookie_b"; do
  echo "::add-mask::$secret"
done
test "$secret_a" != "$secret_b" && test "$cookie_a" != "$cookie_b"
DATABASE_URL="$db_a" REDIS_URL="$redis_a" \
  pnpm --filter @dtc/backend exec medusa user \
  -e admin-a@shqipshop.example.invalid -p "$SHQIPSHOP_A_ADMIN_PASSWORD" >/dev/null
DATABASE_URL="$db_b" REDIS_URL="$redis_b" \
  pnpm --filter @dtc/backend exec medusa user \
  -e admin-b@shqipshop.example.invalid -p "$SHQIPSHOP_B_ADMIN_PASSWORD" >/dev/null

# Verify a previous HTTP probe was not accidentally left running.
if curl -fsS --max-time 2 http://127.0.0.1:9000/health >/dev/null 2>&1 ||
   curl -fsS --max-time 2 http://127.0.0.1:9001/health >/dev/null 2>&1; then
  echo "::error::SHQIPSHOP_226_AB_PORT_ALREADY_OCCUPIED"; exit 1
fi
pid_a=""
pid_b=""
cleanup() {
  for pid in "$pid_a" "$pid_b"; do
    if [[ -n "$pid" ]]; then
      kill -TERM -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT
setsid env DATABASE_URL="$db_a" REDIS_URL="$redis_a" \
  JWT_SECRET="$secret_a" COOKIE_SECRET="$cookie_a" \
  pnpm --filter @dtc/backend exec medusa develop --port 9000 \
  > "$RUNNER_TEMP/shqipshop226-a-api.log" 2>&1 &
pid_a=$!
setsid env DATABASE_URL="$db_b" REDIS_URL="$redis_b" \
  JWT_SECRET="$secret_b" COOKIE_SECRET="$cookie_b" \
  pnpm --filter @dtc/backend exec medusa develop --port 9001 \
  > "$RUNNER_TEMP/shqipshop226-b-api.log" 2>&1 &
pid_b=$!
ready=0
for attempt in $(seq 1 100); do
  if curl -fsS --max-time 3 http://127.0.0.1:9000/health >/dev/null 2>&1 &&
     curl -fsS --max-time 3 http://127.0.0.1:9001/health >/dev/null 2>&1; then
    ready=1; break
  fi
  if ! kill -0 "$pid_a" 2>/dev/null || ! kill -0 "$pid_b" 2>/dev/null; then
    break
  fi
  sleep 3
done
if [[ "$ready" != "1" ]]; then
  echo "::error::SHQIPSHOP_226_AB_BOTH_APIS_NOT_READY"
  exit 1
fi
echo "SHQIPSHOP_226_AB_TWO_SIMULTANEOUS_MEDUSA_APIS_READY"

SHQIPSHOP_CI_MEDUSA_PORT=9000 \
  SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE="$SHQIPSHOP_A_KEY_FILE" \
  SHQIPSHOP_CI_EMPTY_CHANNEL_KEY_FILE="$SHQIPSHOP_CHANNEL_A_FILE" \
  SHQIPSHOP_CI_ORDER_ID_FILE="$SHQIPSHOP_A_ORDER_FILE" \
  SHQIPSHOP_CI_CART_ID_FILE="$SHQIPSHOP_A_CART_FILE" \
  node scripts/store-api-checkout.mjs
SHQIPSHOP_CI_MEDUSA_PORT=9001 \
  SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE="$SHQIPSHOP_B_KEY_FILE" \
  SHQIPSHOP_CI_EMPTY_CHANNEL_KEY_FILE="$SHQIPSHOP_CHANNEL_B_FILE" \
  SHQIPSHOP_CI_ORDER_ID_FILE="$SHQIPSHOP_B_ORDER_FILE" \
  SHQIPSHOP_CI_CART_ID_FILE="$SHQIPSHOP_B_CART_FILE" \
  node scripts/store-api-checkout.mjs
node scripts/parallel-merchant-boundary.mjs
node scripts/parallel-auth-boundary.mjs
kill -0 "$pid_a" && kill -0 "$pid_b"
echo "SHQIPSHOP_226_AB_DISPOSABLE_ORDERS_JWT_COOKIE_MUTATIONS_PASSED"
echo "SHQIPSHOP_226_AB_NOT_PRODUCTION_OR_PSP_CERTIFICATION"
