/* CI-only synthetic checks against installed 2.22.6 query utility package.
 * This is not HTTP/tenant/PSP certification.
 */
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");

const root = process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR;
assert.equal(process.env.CI, "true");
assert.equal(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_CI, "true");
assert.ok(root, "Disposable candidate required");
const requireCandidate = createRequire(path.resolve(root, "package.json"));
const { objectFromStringPath, remoteQueryObjectFromString, isUnsafePathSegment } = requireCandidate("@medusajs/utils");
assert.equal(typeof objectFromStringPath, "function");
assert.equal(typeof remoteQueryObjectFromString, "function");
assert.equal(typeof isUnsafePathSegment, "function");

const safe = objectFromStringPath(["title", "variants.id", "variants.prices.amount"]);
assert.equal(safe.title, true);
assert.equal(safe.variants.id, true);
assert.equal(safe.variants.prices.amount, true);
const querySafe = remoteQueryObjectFromString({
  entryPoint: "product", variables: {}, fields: ["id", "variants.id"],
});
assert.deepEqual(querySafe.__value.product.fields, ["id"]);
assert.deepEqual(querySafe.__value.product.variants.fields, ["id"]);

const key = "shqipshopSyntheticProbe";
assert.equal(Object.prototype[key], undefined);
for (const segment of ["__proto__", "constructor", "prototype"]) {
  assert.equal(isUnsafePathSegment(segment), true);
}
const bad = objectFromStringPath([
  "__proto__." + key, "constructor.prototype." + key,
  "variants.__proto__." + key, "variants.id",
]);
assert.equal(Object.prototype[key], undefined);
assert.equal(Object.hasOwn(bad, "constructor"), false);
assert.equal(Object.hasOwn(bad, "__proto__"), false);
assert.equal(bad.variants.id, true);
const query = remoteQueryObjectFromString({
  entryPoint: "product", variables: {},
  fields: ["id", "variants.id", "__proto__." + key,
           "constructor.prototype." + key, "variants.__proto__." + key],
});
assert.equal(Object.prototype[key], undefined);
assert.deepEqual(query.__value.product.fields, ["id"]);
assert.deepEqual(query.__value.product.variants.fields, ["id"]);
assert.equal(Object.hasOwn(query.__value.product, "constructor"), false);
assert.equal(Object.hasOwn(query.__value.product, "__proto__"), false);
console.log("SHQIPSHOP_MEDUSA_226_DISPOSABLE_QUERY_UTILITY_POSITIVE_NEGATIVE_PASSED");
