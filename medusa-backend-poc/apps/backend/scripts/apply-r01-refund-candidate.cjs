"use strict";

// Applies the experimental change to one locked, runner-local install only.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.CI, "true");
assert.equal(process.env.NODE_ENV, "development");
assert.equal(process.env.SHQIPSHOP_R01_REFUND_CANDIDATE_CI, "true");
assert.equal(process.env.DATABASE_URL, "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci");
assert.equal(process.env.REDIS_URL, "redis://127.0.0.1:6379");

const store = path.resolve(__dirname, "../../../node_modules/.pnpm");
const localStore = fs.realpathSync(store);
const packages = fs.readdirSync(localStore);
function prepareEdit(packageName, relativePath, digest, original, replacement) {
  const candidates = packages
    .filter((entry) => entry.startsWith(`@medusajs+${packageName}@2.22.0_`))
    .map((entry) => path.join(localStore, entry, "node_modules", "@medusajs", packageName, relativePath))
    .filter((entry) => fs.existsSync(entry));
  assert.equal(candidates.length, 1, `Expected one installed @medusajs/${packageName} 2.22.0`);
  const target = fs.realpathSync(candidates[0]);
  assert.ok(target.startsWith(localStore + path.sep), "Module must be inside the local install");
  const source = fs.readFileSync(target, "utf8");
  assert.equal(createHash("sha256").update(source).digest("hex"), digest, packageName);
  assert.equal(source.split(original).length, 2, packageName);
  return { target, content: source.replace(original, replacement) };
}

const original =
  "        if (utils_1.MathBN.lt(utils_1.MathBN.sub(capturedAmount, totalRefundedAmount), -currencyEpsilon)) {";
function exactAllCheck(amount) {
  return [
    `        const amount = utils_1.MathBN.convert(${amount});`,
    "        const invalidAllRefund = upperCurCode === 'ALL' && (",
    "            !amount.isInteger() || !amount.isPositive() || amount.gt(Number.MAX_SAFE_INTEGER) ||",
    "            !capturedAmount.isInteger() || !capturedAmount.gt(0) ||",
    "            !refundedAmount.isInteger() || refundedAmount.lt(0) ||",
    "            totalRefundedAmount.gt(capturedAmount)",
    "        );",
    "        if (invalidAllRefund || (upperCurCode !== 'ALL' &&",
    "            utils_1.MathBN.lt(utils_1.MathBN.sub(capturedAmount, totalRefundedAmount), -currencyEpsilon))) {",
  ].join("\n");
}

// The Payment Module write check is after the row lock and replay decision.
// The plural workflow must also reject a bad request before its step can
// catch the module error and continue. Its read carries no write authority.
const edits = [
  prepareEdit("payment", "dist/services/payment-module.js",
    "eb7aa60d186f5dc018740f43b45c6ae816e9bc91d4150293b8338f7d1db92c11",
    original, exactAllCheck("data.amount")),
  prepareEdit("core-flows", "dist/payment/workflows/refund-payments.js",
    "b017ec57371386e8988f345d9cdf30459d2bd70dee747b81f5744cd18783e349",
    original, exactAllCheck("amountToRefund")),
];
// Verify both pinned inputs first. Rename replacements so pnpm's store
// hard links to the original files are never written in place.
for (const { target, content } of edits) {
  const staged = target + ".r01-candidate";
  fs.writeFileSync(staged, content, { flag: "wx", mode: fs.statSync(target).mode & 0o777 });
  fs.renameSync(staged, target);
}
console.log("SHQIPSHOP_R01_LOCKED_REFUND_AMOUNT_CANDIDATE_APPLIED");
