"use strict";

// Applies the experimental change to one locked, runner-local install only.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

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
const transformInputs = "(0, workflows_sdk_1.transform)({ payments, input }, ({ payments, input }) => {";
const nativeResults = "const successfulRefunds = (await (0, utils_1.promiseAll)(promises)).filter((payment) => (0, utils_1.isObject)(payment));";
const outcomeHelper = JSON.stringify(require.resolve("./r01-confirmed-refunds.cjs"));
const outcome = `require(${outcomeHelper})`;
const postings = `require(${JSON.stringify(require.resolve("./r01-order-postings.cjs"))})`;
const moneyEqual = "(a, b) => utils_1.MathBN.eq(a, b)";
const replayFields = ['"refunds.raw_amount",', '"refunds.raw_amount", "refunds.idempotency_key", "refunds.status",'];
const pinnedFiles = [
  ["payment", "dist/services/payment-module.js",
    "eb7aa60d186f5dc018740f43b45c6ae816e9bc91d4150293b8338f7d1db92c11",
    [
      [original, exactAllCheck("data.amount")],
      ['return await this.retrievePayment(payment.id, { relations: ["refunds"] }, sharedContext);',
        `const updated = await this.retrievePayment(payment.id, { relations: ["refunds"] }, sharedContext);\n        return ${outcome}.writerResult(data, updated, refund.id);`],
    ]],
  // Keep the public array-in/array-out step for other callers. Only the
  // candidate workflow requests a reply correlated to each input position.
  ["core-flows", "dist/payment/steps/refund-payments.js",
    "6dffd01939fb9da7c578e22e3c2574ee04d714bc81407896e91851754a1a15bc", [
      ["for (const refundInput of input) {",
        [
          "const requests = Array.isArray(input) ? input : input.requests;",
          `    if (!Array.isArray(input)) await ${outcome}.checkLegacyReferences(container.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION), requests);`,
          "    for (const refundInput of requests) {",
        ].join("\n")],
      ["paymentModule.refundPayment(refundInput)",
        `paymentModule.refundPayment(Array.isArray(input) ? refundInput : ${outcome}.withReceipt(refundInput))`],
      [nativeResults, [
        "const replies = await (0, utils_1.promiseAll)(promises);",
        "    if (!Array.isArray(input)) {",
        `        return new workflows_sdk_1.StepResponse(require(${outcomeHelper})(requests, replies));`,
        "    }",
        "    const successfulRefunds = replies.filter((payment) => (0, utils_1.isObject)(payment));",
      ].join("\n")],
    ]],
  ["core-flows", "dist/payment/workflows/refund-payments.js",
    "b017ec57371386e8988f345d9cdf30459d2bd70dee747b81f5744cd18783e349", [
      [original, exactAllCheck("amountToRefund")],
      replayFields,
      ['"refunds.id",', '"amount", "raw_amount", "refunds.id",'],
      ["const paymentIdAmountMap = new Map(input.map(({ payment_id, amount }) => [payment_id, amount]));",
        "const requestsByPayment = Map.groupBy(input, request => request.payment_id);"],
      ["const amountToRefund = paymentIdAmountMap.get(payment.id);", [
        "const requests = requestsByPayment.get(payment.id);",
        "        let amountToRefund = requests.at(-1).amount;",
        "        if (payment.currency_code?.toUpperCase() === 'ALL') {",
        `            amountToRefund = ${outcome}.freshAllAmount(payment, requests, utils_1.MathBN, () => new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Invalid ALL refund amount or conflicting key in batch"));`,
        "            if (amountToRefund.isZero()) continue;",
        "        }",
      ].join("\n")],
      ["(0, exports.validatePaymentsRefundStep)({ payments, input });",
        "const validation = (0, exports.validatePaymentsRefundStep)({ payments, input });"],
      ["const refundedPayments = (0, refund_payments_1.refundPaymentsStep)(input);", [
        "const confirmed = (0, refund_payments_1.refundPaymentsStep)({ requests: input, validation });",
        "    const refundedPayments = (0, workflows_sdk_1.transform)({ confirmed }, ({ confirmed }) => confirmed.map((entry) => entry.payment));",
      ].join("\n")],
      [transformInputs, "(0, workflows_sdk_1.transform)({ payments, confirmed }, ({ payments, confirmed }) => {"],
      ["return input\n            .map((paymentInput) => {",
        "return confirmed\n            .map(({ request: paymentInput, refund }) => {"],
      ["utils_1.MathBN.mult(paymentInput.amount, -1)", "utils_1.MathBN.mult(refund.raw_amount ?? refund.amount, -1)"],
      ["reference_id: payment.id,", "reference_id: refund.id,"],
    ]],
  ["core-flows", "dist/payment/steps/refund-payment.js",
    "bcc923debfc69169630400426e1b2477b5449f506ba0d3952292793a40ef3c46", [
      ["const payment = await paymentModule.refundPayment(input);", [
        "if (input.request && !input.payment_id) {",
        `        await ${outcome}.checkLegacyReferences(container.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION), [input.request]);`,
        `        const { payment, refund } = await paymentModule.refundPayment(${outcome}.withReceipt(input.request));`,
        "        return new workflows_sdk_1.StepResponse({ ...payment, refunds: [refund] });",
        "    }",
        "    const payment = await paymentModule.refundPayment(input);",
      ].join("\n")],
    ]],
  ["core-flows", "dist/payment/workflows/refund-payment.js",
    "f096ada0f854fc32222d9e72089e778e36f434297648f8ec778114ae5b7e108f", [
      replayFields,
      // Use the native order lock before the financial writer. Keep it through
      // the order transaction, credit change and event. Each invocation owns
      // its own lease, including simultaneous replays with the same key.
      ['exports.refundPaymentWorkflowId = "refund-payment-workflow";', [
        'const orderLocks = require("../../locking");',
        'const orderLockInput = (0, workflows_sdk_1.createStep)("r01-refund-order-lock-input", async (orderId) =>',
        '    new workflows_sdk_1.StepResponse({ key: orderId, ownerId: require("node:crypto").randomUUID(), timeout: 10, ttl: 60, executeOnSubWorkflow: true }));',
        'exports.refundPaymentWorkflowId = "refund-payment-workflow";',
      ].join("\n")],
      ['const order = (0, common_1.useRemoteQueryStep)({', [
        'const orderLock = orderLockInput(orderPaymentCollection.order.id);',
        '    orderLocks.acquireLockStep(orderLock);',
        '    const order = (0, common_1.useRemoteQueryStep)({',
      ].join("\n")],
      ['return new workflows_sdk_1.WorkflowResponse(payment);', [
        'orderLocks.releaseLockStep(orderLock);',
        '    return new workflows_sdk_1.WorkflowResponse(payment);',
      ].join("\n")],
      ["async function ({ payment, refundAmount, }) {",
        `async function ({ payment, refundAmount, idempotencyKey }) {\n    if (payment.currency_code?.toUpperCase() === "ALL" && ${outcome}.keyedReplay(payment, { idempotency_key: idempotencyKey, amount: refundAmount }, ${moneyEqual})) return;`],
      ["refundAmount: input.amount,", "refundAmount: input.amount, idempotencyKey: input.idempotency_key,"],
      ["(0, refund_payment_1.refundPaymentStep)(input)", "(0, refund_payment_1.refundPaymentStep)({ request: input })"],
      ["input.amount ?? refund.raw_amount ?? refund.amount", "refund.raw_amount ?? refund.amount"],
    ]],
  ["core-flows", "dist/order/steps/add-order-transaction.js",
    "94dc896b9e00342ca11a219267bb2592c7d96d8edf6aaa4e3a939ba854c4796d", [
      ["const existing = await service.listOrderTransactions({",
        `const existing = ${postings}.isRefundBatch(trxsData) ? [] : await service.listOrderTransactions({`],
    ]],
  ["order", "dist/services/order-module-service.js",
    "26ac4c717a995fc356c895920fbff6e209586b551a4799ccaf8202e20fdc752c", [
      ["async addOrderTransactions_(transactionData, sharedContext = {}) {", [
        "async addOrderTransactions_(transactionData, sharedContext = {}) {",
        `        if (${postings}.isRefundBatch(transactionData)) {`,
        `            transactionData = await ${postings}.missingPostings(transactionData, sharedContext, ${moneyEqual});`,
        "            if (!transactionData.length) return [];",
        "        }",
      ].join("\n")],
    ]],
];

function patchedSource(relativePath, source) {
  const pinned = pinnedFiles.find(([, path]) => path === relativePath);
  assert.ok(pinned, "Only registered R01 candidate files can be transformed");
  const [packageName, , digest, replacements] = pinned;
  assert.equal(createHash("sha256").update(source).digest("hex"), digest, packageName);
  let content = source;
  for (const [original, replacement] of replacements) {
    assert.equal(content.split(original).length, 2, relativePath);
    content = content.replace(original, () => replacement);
  }
  return content;
}

function applyCandidate() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.CI, "true");
  assert.equal(process.env.NODE_ENV, "development");
  assert.equal(process.env.SHQIPSHOP_R01_REFUND_CANDIDATE_CI, "true");
  assert.equal(process.env.DATABASE_URL, "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci");
  assert.equal(process.env.REDIS_URL, "redis://127.0.0.1:6379");

  const store = path.resolve(__dirname, "../../../node_modules/.pnpm");
  const localStore = fs.realpathSync(store);
  const packages = fs.readdirSync(localStore);
  const edits = pinnedFiles.map(([packageName, relativePath]) => {
    const candidates = packages
      .filter((entry) => entry.startsWith(`@medusajs+${packageName}@2.22.0_`))
      .map((entry) => path.join(localStore, entry, "node_modules", "@medusajs", packageName, relativePath))
      .filter((entry) => fs.existsSync(entry));
    assert.equal(candidates.length, 1, `Expected one installed @medusajs/${packageName} 2.22.0`);
    const target = fs.realpathSync(candidates[0]);
    assert.ok(target.startsWith(localStore + path.sep), "Module must be inside the local install");
    return { target, content: patchedSource(relativePath, fs.readFileSync(target, "utf8")) };
  });
  // Verify all pinned inputs first. Rename replacements so pnpm's store
  // hard links to the original files are never written in place.
  for (const { target, content } of edits) {
    const staged = target + ".r01-candidate";
    fs.writeFileSync(staged, content, { flag: "wx", mode: fs.statSync(target).mode & 0o777 });
    fs.renameSync(staged, target);
  }
  console.log("SHQIPSHOP_R01_LOCKED_REFUND_AMOUNT_CANDIDATE_APPLIED");
}

if (require.main === module) applyCandidate();
module.exports = { patchedSource };
