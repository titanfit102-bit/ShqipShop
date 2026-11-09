"use strict";
/**
 * Stage 12Q — synthetic, isolated Medusa 2.22.6 Redis A pause/unpause.
 *
 * A's Redis must stop answering while B remains responsive. A's authenticated
 * cookie requests must never return customer/admin identity during the pause;
 * after recovery, both A cookies must work and B's cookies must still be
 * rejected by A. No Redis FLUSH, destructive restart or live credentials.
 *
 * This tests an injected short connection stall, NOT HA/failover or lost data.
 */
const assert = require("node:assert/strict");
const { readFileSync, realpathSync } = require("node:fs");
const { relative, isAbsolute, sep, join } = require("node:path");
const { createConnection } = require("node:net");

let probePhase = "BOOT"
const expected = {
  CI: "true",
  NODE_ENV: "development",
  SHQIPSHOP_MEDUSA_CANDIDATE_CI: "true",
  SHQIPSHOP_REQUIRE_REDIS: "true",
};
for (const [name, value] of Object.entries(expected)) {
  assert.equal(process.env[name], value, "Only disposable CI is permitted");
}
assert.equal(process.env.REDIS_URL, "redis://127.0.0.1:6379");
const temp = realpathSync(process.env.RUNNER_TEMP);
const candidate = realpathSync(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const proofPath = realpathSync(process.env.SHQIPSHOP_CI_SESSION_PROOF_FILE);
for (const item of [candidate, proofPath]) {
  const rel = relative(temp, item);
  assert.ok(rel && rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel),
    "Only disposable runner files are permitted");
}
const manifest = JSON.parse(readFileSync(join(candidate, "apps/backend/package.json"), "utf8"));
assert.equal(manifest.dependencies["@medusajs/medusa"], "2.22.6");
const proof = JSON.parse(readFileSync(proofPath, "utf8"));
for (const id of ["A", "B"]) {
  assert.ok(proof[id]?.key?.length > 10);
  for (const actor of ["customer", "admin"]) {
    assert.ok(proof[id][actor]?.id && proof[id][actor]?.cookie?.includes("connect.sid="));
  }
}

const HOST = "127.0.0.1";
function redis(port, args, timeoutMs = 2500) {
  assert.ok([6379, 6381].includes(port));
  const raw = "*" + args.length + "\r\n" +
    args.map(a => "$" + Buffer.byteLength(a) + "\r\n" + a + "\r\n").join("");
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: HOST, port });
    let settled = false;
    let reply = "";
    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish(new Error("Redis control timeout")));
    socket.once("error", () => finish(new Error("Redis control connection error")));
    socket.once("connect", () => socket.write(raw));
    socket.on("data", data => {
      reply += data.toString("utf8");
      if (reply.includes("\r\n")) {
        const line = reply.slice(0, reply.indexOf("\r\n"));
        if (line !== "+OK" && line !== "+PONG") {
          finish(new Error("Unexpected Redis control result"));
        } else finish(null, line);
      }
    });
    socket.once("end", () => finish(new Error("Redis control closed")));
  });
}

async function identity(port, tenant, actor, timeoutMs = 7000) {
  const target = tenant[actor];
  const path = actor === "customer" ? "/store/customers/me" : "/admin/users/me";
  const headers = { cookie: target.cookie };
  if (actor === "customer") headers["x-publishable-api-key"] = tenant.key;
  try {
    const result = await fetch("http://" + HOST + ":" + port + path, {
      method: "GET",
      redirect: "manual",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (result.status !== 200) return { status: result.status };
    const json = await result.json();
    const obj = json[actor === "customer" ? "customer" : "user"];
    return { status: 200, id: obj?.id };
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return { status: "timeout" };
    }
    throw new Error("Protected HTTP request failed unexpectedly");
  }
}
async function validOn(port, tenant, actor) {
  const result = await identity(port, tenant, actor);
  if (result.status !== 200) probePhase += "_STATUS_" + String(result.status);
  else if (result.id !== tenant[actor].id) probePhase += "_PRINCIPAL_MISMATCH";
  assert.equal(result.status, 200, "Expected same-merchant session to be accepted");
  assert.equal(result.id, tenant[actor].id, "Session returned the wrong principal");
}
async function denyOn(port, tenant, actor) {
  const result = await identity(port, tenant, actor);
  if (![401, 403].includes(result.status)) probePhase += "_STATUS_" + String(result.status);
  assert.ok([401, 403].includes(result.status),
    "Foreign merchant cookie was not denied");
}

async function main() {
  probePhase = "A_REDIS_BASELINE_PING";
  await redis(6379, ["PING"]);
  probePhase = "B_REDIS_BASELINE_PING";
  await redis(6381, ["PING"]);
  probePhase = "BASELINE_COOKIE_IDENTITIES";
  for (const actor of ["customer", "admin"]) {
    probePhase = "BASELINE_" + actor.toUpperCase() + "_A_CLONE";
    await validOn(9002, proof.A, actor);
    probePhase = "BASELINE_" + actor.toUpperCase() + "_B_ORIGIN";
    await validOn(9001, proof.B, actor);
    probePhase = "BASELINE_" + actor.toUpperCase() + "_B_FOREIGN_DENIED";
    await denyOn(9002, proof.B, actor);
  }
  console.log("SHQIPSHOP_226_STAGE12Q_PRE_OUTAGE_SESSIONS_PASSED");

  let pauseStarted = false;
  try {
    probePhase = "A_CLIENT_PAUSE";
    assert.equal(await redis(6379, ["CLIENT", "PAUSE", "16000", "ALL"]), "+OK");
    pauseStarted = true;
    // Confirm A Redis is actually stalled, rather than interpreting any
    // random API failure as an outage. B remains independently responsive.
    probePhase = "PAUSE_CONFIRMED_PING_TIMEOUT";
    let aPingTimeout = false;
    try { await redis(6379, ["PING"], 650); }
    catch (err) {
      assert.equal(err.message, "Redis control timeout");
      aPingTimeout = true;
    }
    assert.equal(aPingTimeout, true, "A Redis did not enter the injected stall");
    assert.equal(await redis(6381, ["PING"], 2500), "+PONG",
      "B Redis unavailable during A outage");
    console.log("SHQIPSHOP_226_STAGE12Q_A_REDIS_STALL_B_REDIS_HEALTHY");

    probePhase = "A_COOKIE_WITH_REDIS_STALLED";
    for (const actor of ["customer", "admin"]) {
      const stalled = await identity(9002, proof.A, actor, 1500);
      assert.ok([401, 403, 503, 504, "timeout"].includes(stalled.status),
        "A protected identity was exposed or an unexpected server status occurred while A Redis was stalled");
    }
    console.log("SHQIPSHOP_226_STAGE12Q_A_PROTECTED_IDENTITIES_NOT_EXPOSED_DURING_STALL");
    probePhase = "B_COOKIE_INDEPENDENCE";
    for (const actor of ["customer", "admin"]) {
      await validOn(9001, proof.B, actor);
    }
    console.log("SHQIPSHOP_226_STAGE12Q_B_SESSIONS_INDEPENDENT_DURING_A_STALL");
  } finally {
    // CLIENT UNPAUSE is accepted on a fresh control connection while paused.
    // The 16s Redis pause also auto-expires if an assertion fails. Never
    // leave a stalled Redis endpoint intentionally.
    if (pauseStarted) {
      probePhase = "A_REDIS_UNPAUSE";
      await redis(6379, ["CLIENT", "UNPAUSE"], 5000);
    }
  }

  probePhase = "A_REDIS_RECOVERED";
  assert.equal(await redis(6379, ["PING"]), "+PONG");
  probePhase = "RECOVERED_IDENTITY_VALIDATION";
  for (const actor of ["customer", "admin"]) {
    await validOn(9002, proof.A, actor);
    await validOn(9000, proof.A, actor);
    await denyOn(9002, proof.B, actor);
    await validOn(9001, proof.B, actor);
  }
  probePhase = "RECOVERED_PROCESS_HEALTH";
  for (const port of [9000, 9001, 9002]) {
    const h = await fetch("http://" + HOST + ":" + port + "/health", {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(h.status, 200, "A/B process not healthy after controlled pause");
  }
  console.log("SHQIPSHOP_226_STAGE12Q_REDIS_RESUME_SESSION_RECOVERY_PASSED");
  console.log("SHQIPSHOP_226_STAGE12Q_CI_ONLY_NOT_REDIS_HA_OR_JWT_REVOCATION");
}
main().catch(() => {
  // No token, cookie, body or internal Redis key data ever printed.
  console.error("::error::SHQIPSHOP_226_STAGE12Q_REDIS_SESSION_PROBE_FAILED_AT_" + probePhase);
  process.exitCode = 1;
});
