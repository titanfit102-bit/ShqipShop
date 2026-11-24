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
const candidates = fs.readdirSync(store)
  .filter((entry) => entry.startsWith("@medusajs+payment@2.22.0_"))
  .map((entry) => path.join(store, entry, "node_modules/@medusajs/payment/dist/services/payment-module.js"))
  .filter((entry) => fs.existsSync(entry));
assert.equal(candidates.length, 1, "Expected one installed Medusa Payment Module 2.22.0");
const target = fs.realpathSync(candidates[0]);
assert.ok(target.startsWith(fs.realpathSync(store) + path.sep), "Payment Module must be inside the local install");
const source = fs.readFileSync(target, "utf8");
const digest = createHash("sha256").update(source).digest("hex");
assert.equal(digest, "eb7aa60d186f5dc018740f43b45c6ae816e9bc91d4150293b8338f7d1db92c11");

const original =
  "        if (utils_1.MathBN.lt(utils_1.MathBN.sub(capturedAmount, totalRefundedAmount), -currencyEpsilon)) {";
assert.equal(source.split(original).length, 2);
// The pinned anchor is after the native row lock and replay decision, and
// before a refund row is created or resumed. Keep other currencies on the
// existing upstream path. Refund and capture totals use upstream BigNumber.
const replacement = [
  "        const amount = utils_1.MathBN.convert(data.amount);",
  "        const invalidAllRefund = upperCurCode === 'ALL' && (",
  "            !amount.isInteger() || !amount.isPositive() || amount.gt(Number.MAX_SAFE_INTEGER) ||",
  "            !capturedAmount.isInteger() || !capturedAmount.gt(0) ||",
  "            !refundedAmount.isInteger() || refundedAmount.lt(0) ||",
  "            totalRefundedAmount.gt(capturedAmount)",
  "        );",
  "        if (invalidAllRefund || (upperCurCode !== 'ALL' &&",
  "            utils_1.MathBN.lt(utils_1.MathBN.sub(capturedAmount, totalRefundedAmount), -currencyEpsilon))) {",
].join("\n");

// Replace the file atomically so pnpm's shared package store remains intact.
const staged = target + ".r01-candidate";
fs.writeFileSync(staged, source.replace(original, replacement), {
  flag: "wx",
  mode: fs.statSync(target).mode & 0o777,
});
fs.renameSync(staged, target);
console.log("SHQIPSHOP_R01_LOCKED_REFUND_AMOUNT_CANDIDATE_APPLIED");
