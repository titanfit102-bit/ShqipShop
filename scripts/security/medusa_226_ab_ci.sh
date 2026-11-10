#!/usr/bin/env bash
# Stage 12O/12P: replay order/JWT/mutation and same-merchant session handoff CI
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
node --check scripts/verify-redis-session-handoff.mjs
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
pid_clone=""
pid_aof=""
aof_container=""
cleanup() {
  for pid in "$pid_a" "$pid_b" "$pid_clone" "$pid_aof"; do
    if [[ -n "$pid" ]]; then
      kill -TERM -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    fi
  done
  if [[ -n "$aof_container" ]]; then
    docker rm -f "$aof_container" >/dev/null 2>&1 || true
  fi
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

# Stage 12P: A's authenticated cookie must be accepted by a NEW, simultaneously
# running A process with the SAME isolated Redis/DB/session signing keys.
# B's cookie and no-cookie requests must be denied by the new A process.
# Reuse the pre-existing verified identity/cookie assertions, no mock server.
if [[ ! -s "$SHQIPSHOP_CI_SESSION_PROOF_FILE" ]]; then
  echo "::error::SHQIPSHOP_226_STAGE12P_SESSION_PROOF_MISSING"
  exit 1
fi
if curl -fsS --max-time 2 http://127.0.0.1:9002/health >/dev/null 2>&1; then
  echo "::error::SHQIPSHOP_226_STAGE12P_CLONE_PORT_OCCUPIED"
  exit 1
fi
setsid env DATABASE_URL="$db_a" REDIS_URL="$redis_a" \
  JWT_SECRET="$secret_a" COOKIE_SECRET="$cookie_a" \
  pnpm --filter @dtc/backend exec medusa develop --port 9002 \
  > "$RUNNER_TEMP/shqipshop226-a-clone-api.log" 2>&1 &
pid_clone=$!
clone_ready=0
for attempt in $(seq 1 100); do
  if curl -fsS --max-time 3 http://127.0.0.1:9002/health >/dev/null 2>&1; then
    clone_ready=1
    break
  fi
  if ! kill -0 "$pid_clone" 2>/dev/null; then break; fi
  sleep 3
done
if [[ "$clone_ready" != "1" ]]; then
  echo "::error::SHQIPSHOP_226_STAGE12P_CLONE_NOT_READY"
  exit 1
fi
node scripts/verify-redis-session-handoff.mjs
kill -0 "$pid_a" && kill -0 "$pid_b" && kill -0 "$pid_clone"
curl -fsS --max-time 5 http://127.0.0.1:9000/health >/dev/null
curl -fsS --max-time 5 http://127.0.0.1:9001/health >/dev/null
echo "SHQIPSHOP_226_STAGE12P_SAME_MERCHANT_CROSS_PROCESS_COOKIE_PASSED"
node "$GITHUB_WORKSPACE/scripts/security/medusa_226_redis_outage_probe.cjs"
node "$GITHUB_WORKSPACE/scripts/security/medusa_226_redis_restart_probe.cjs"

# Stage 12S: a NEW disposable Redis with append-only persistence starts with
# AOF enabled. No mutation of the A or B service Redis instances. No real data.
if [[ -z "${GITHUB_RUN_ID:-}" || ! "$GITHUB_RUN_ID" =~ ^[0-9]+$ ||
      "$SHQIPSHOP_MEDUSA_CANDIDATE_CI" != "true" ]]; then
  echo "::error::SHQIPSHOP_226_STAGE12S_SCOPE_REJECTED"; exit 1
fi
if curl -fsS --max-time 2 http://127.0.0.1:9003/health >/dev/null 2>&1; then
  echo "::error::SHQIPSHOP_226_STAGE12S_API_PORT_OCCUPIED"; exit 1
fi
if timeout 2 bash -c 'echo > /dev/tcp/127.0.0.1/6382' >/dev/null 2>&1; then
  echo "::error::SHQIPSHOP_226_STAGE12S_REDIS_PORT_OCCUPIED"; exit 1
fi
aof_cidfile="$RUNNER_TEMP/shqipshop226-stage12s.cid"
docker run -d --cidfile "$aof_cidfile" \
  --name "shqipshop-stage12s-$GITHUB_RUN_ID" \
  --label shqipshop.scope=stage12s-ci \
  --network bridge -p 127.0.0.1:6382:6379 \
  redis:7-alpine redis-server --save "" --appendonly yes --appendfsync always \
  > /dev/null
aof_container="$(cat "$aof_cidfile")"
[[ "$aof_container" =~ ^[a-f0-9]{64}$ ]] || {
  echo "::error::SHQIPSHOP_226_STAGE12S_INVALID_CONTAINER"; exit 1
}
aof_ready=0
for attempt in $(seq 1 50); do
  if [[ "$(docker exec "$aof_container" redis-cli PING 2>/dev/null || true)" == "PONG" ]]; then
    aof_ready=1; break
  fi
  sleep 1
done
if [[ "$aof_ready" != "1" ]]; then
  echo "::error::SHQIPSHOP_226_STAGE12S_REDIS_NOT_READY"; exit 1
fi
setsid env DATABASE_URL="$db_a" REDIS_URL="redis://127.0.0.1:6382" \
  JWT_SECRET="$secret_a" COOKIE_SECRET="$cookie_a" \
  pnpm --filter @dtc/backend exec medusa develop --port 9003 \
  > "$RUNNER_TEMP/shqipshop226-stage12s-api.log" 2>&1 &
pid_aof=$!
aof_api_ready=0
for attempt in $(seq 1 100); do
  if curl -fsS --max-time 3 http://127.0.0.1:9003/health >/dev/null 2>&1; then
    aof_api_ready=1; break
  fi
  if ! kill -0 "$pid_aof" 2>/dev/null; then break; fi
  sleep 3
done
if [[ "$aof_api_ready" != "1" ]]; then
  echo "::error::SHQIPSHOP_226_STAGE12S_AOF_API_NOT_READY"; exit 1
fi
export SHQIPSHOP_STAGE12S_AOF_ID="$aof_container"
node "$GITHUB_WORKSPACE/scripts/security/medusa_226_aof_session_probe.cjs"
kill -0 "$pid_a" && kill -0 "$pid_b" && kill -0 "$pid_clone" && kill -0 "$pid_aof"
echo "SHQIPSHOP_226_AB_NOT_PRODUCTION_OR_PSP_CERTIFICATION"
