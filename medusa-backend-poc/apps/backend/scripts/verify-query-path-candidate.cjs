"use strict";
/**
 * Stage 12C — candidate-only utility regression for Medusa 2.22.6.
 * Does not upgrade/install dependencies, access a network/PSP or authorize release.
 * Invoke ONLY in a separately approved disposable CI install, from apps/backend:
 * CI=true SHQIPSHOP_MEDUSA_QUERY_CANDIDATE_CI=true node scripts/verify-query-path-candidate.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const expected = "2.22.6";
assert.equal(process.env.CI, "true", "Candidate CI-only script");
assert.equal(process.env.SHQIPSHOP_MEDUSA_QUERY_CANDIDATE_CI, "true", "Explicit disposable candidate flag required");

const backend = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
const workspace = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../package.json"), "utf8"));
for (const manifest of [backend, workspace]) {
  for (const scope of ["dependencies", "devDependencies"]) {
    for (const [name, spec] of Object.entries(manifest[scope] || {})) {
      if (!name.startsWith("@medusajs/") || name === "@medusajs/ui") continue;
      assert.equal(spec, expected, "Candidate must not mix Medusa release-train versions");
    }
  }
}
assert.equal(backend.dependencies["@medusajs/framework"], expected);
assert.equal(backend.dependencies["@medusajs/medusa"], expected);

// Framework's public ./utils export re-exports the upstream Medusa utilities.
// Resolve it only after the candidate-only version gate. The Python preflight
// independently checks the pnpm frozen lock before this script can be invoked.
const {remoteQueryObjectFromString, objectFromStringPath} = require("@medusajs/framework/utils");
assert.equal(typeof remoteQueryObjectFromString, "function");
assert.equal(typeof objectFromStringPath, "function");

const clean = remoteQueryObjectFromString({
  entryPoint: "region", variables: {}, fields: ["id", "countries.iso_2"],
});
assert.deepEqual(clean.__value.region.fields, ["id"]);
assert.deepEqual(clean.__value.region.countries.fields, ["iso_2"]);
const knownGood = objectFromStringPath(["catalog.items", "catalog.stock"]);
assert.deepEqual(knownGood, {catalog: {items: true, stock: true}});
console.log("SHQIPSHOP_STAGE12C_VALID_NESTED_QUERY_SHAPE_PASSED");

// Negative regression is from the upstream 2.22.6 query-path security fix.
// The test runs in one disposable Node process; no customer or tenant data.
const prop = "shqipshop_stage12c_private_canary";
const beforeOwn = Object.hasOwn(Object.prototype, prop);
assert.equal(beforeOwn, false, "Pre-existing global mutation: refuse unsafe test");
const tainted = remoteQueryObjectFromString({
  entryPoint: "region", variables: {},
  fields: [
    "id", "countries.iso_2",
    "__proto__."+prop,
    "constructor.prototype."+prop,
    "countries.__proto__."+prop,
  ],
});
assert.equal(Object.hasOwn(Object.prototype, prop), false);
assert.deepEqual(tainted.__value.region.fields, ["id"]);
assert.deepEqual(tainted.__value.region.countries.fields, ["iso_2"]);
assert.equal(Object.hasOwn(tainted.__value.region, "constructor"), false);
assert.equal(Object.hasOwn(tainted.__value.region, "__proto__"), false);
const guarded = objectFromStringPath(["catalog.items", "constructor.prototype."+prop, "__proto__."+prop]);
assert.deepEqual(guarded, {catalog: {items: true}});
assert.equal(Object.hasOwn(Object.prototype, prop), false);
console.log("SHQIPSHOP_STAGE12C_UNSAFE_QUERY_PATH_NO_GLOBAL_MUTATION_PASSED");
console.log("SHQIPSHOP_STAGE12C_MEDUSA_2_22_6_UTILS_REGRESSION_PASSED_NOT_HTTP_OR_PRODUCTION_SECURITY");
