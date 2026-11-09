"use strict";
/**
 * Stage 12N: ONLY disposable Medusa 2.22.6 local Store HTTP query checks.
 * A clean request must work; unsafe dotted field paths must not result in
 * a 5xx, widen the returned region set, or expose unsafe own properties.
 * Rejection (400/422) and safe omission (200) are distinct acceptable
 * outcomes; neither certifies all framework routes or production security.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function requireInside(base, candidate) {
  const baseReal = fs.realpathSync(base);
  const actual = fs.realpathSync(candidate);
  const relative = path.relative(baseReal, actual);
  assert.ok(relative && relative !== ".." &&
    !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative),
    "CI artifacts must be inside disposable RUNNER_TEMP");
  return actual;
}

async function readRegions(fields, apiKey) {
  const url = new URL("/store/regions", "http://127.0.0.1:9000");
  url.searchParams.set("fields", fields);
  const response = await fetch(url, {
    headers: { "x-publishable-api-key": apiKey },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  assert.ok(response.status !== 500 && response.status !== 502 &&
    response.status !== 503 && response.status !== 504,
    "Unsafe query caused a server-side HTTP 5xx");
  assert.ok(response.status === 200 || response.status === 400 ||
    response.status === 422, "Unexpected status on query request");
  if (response.status !== 200) return { status: response.status };
  const payload = await response.json();
  assert.ok(payload && Array.isArray(payload.regions),
    "Medusa region response shape changed");
  const ids = payload.regions.map((region) => {
    assert.ok(region && typeof region.id === "string");
    assert.equal(Object.hasOwn(region, "__proto__"), false);
    assert.equal(Object.hasOwn(region, "constructor"), false);
    assert.equal(Object.hasOwn(region, "prototype"), false);
    return region.id;
  }).sort();
  return { status: response.status, ids };
}

async function main() {
  assert.equal(process.env.CI, "true", "CI-only");
  assert.equal(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_CI, "true",
    "Candidate-only");
  assert.ok(process.env.RUNNER_TEMP, "Disposable runner required");
  assert.ok(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR,
    "Disposable candidate required");
  assert.ok(process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE,
    "Disposable key file required");
  const root = requireInside(process.env.RUNNER_TEMP,
    process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "apps/backend/package.json"), "utf8"));
  assert.equal(manifest.dependencies["@medusajs/medusa"], "2.22.6");
  const keyFile = requireInside(process.env.RUNNER_TEMP,
    process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE);
  const key = fs.readFileSync(keyFile, "utf8").trim();
  assert.ok(key.length >= 10 && !/\s/.test(key), "Malformed ephemeral key");

  const ordinary = await readRegions("id", key);
  assert.equal(ordinary.status, 200, "Normal Store query must succeed");
  assert.ok(ordinary.ids.length > 0, "Missing disposable seed regions");
  const nested = await readRegions("id,countries.iso_2", key);
  assert.equal(nested.status, 200, "Normal nested query must succeed");
  assert.deepEqual(nested.ids, ordinary.ids,
    "Legitimate nested query cannot change region identities");
  console.log("SHQIPSHOP_MEDUSA_226_HTTP_QUERY_POSITIVE_PASSED");

  const canary = "shqipshop_stage12n_canary";
  const unsafe = [
    "id,__proto__." + canary,
    "id,constructor.prototype." + canary,
    "id,countries.__proto__." + canary,
  ];
  for (const fields of unsafe) {
    const result = await readRegions(fields, key);
    if (result.status === 200) {
      assert.deepEqual(result.ids, ordinary.ids,
        "Unsafe field may not widen region results");
    }
  }
  console.log("SHQIPSHOP_MEDUSA_226_HTTP_UNSAFE_PATH_BOUNDED_PASSED");
  console.log("SHQIPSHOP_MEDUSA_226_HTTP_NOT_TENANT_OR_FINANCE_CERTIFICATION");
}
main().catch(() => {
  // Do not leak ephemeral keys or HTTP response bodies into public logs.
  console.error("::error::SHQIPSHOP_MEDUSA_226_HTTP_QUERY_PROBE_FAILED");
  process.exitCode = 1;
});
