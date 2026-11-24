"use strict";

const receiptRequested = Symbol("R01 refund receipt");

function withReceipt(request) {
  return { ...request, [receiptRequested]: true };
}

function writerResult(request, payment, refundId) {
  if (!request[receiptRequested]) return payment;
  const refund = payment.refunds?.find(row => row.id === refundId);
  if (!refund || refund.status !== "succeeded" || payment.id !== request.payment_id) {
    throw new Error("Payment module did not return the confirmed refund");
  }
  return { payment, refund };
}

// The writer selects the receipt inside its native refund operation. A list
// of historical refunds or an amount match cannot identify this operation.
function confirmedRefunds(requests, replies) {
  if (requests.length !== replies.length) {
    throw new Error("Incomplete refund writer results");
  }
  const confirmed = [];
  for (const [index, request] of requests.entries()) {
    const reply = replies[index];
    if (request.payment_id && reply?.payment?.id === request.payment_id &&
        reply.refund?.id && reply.refund.status === "succeeded") {
      confirmed.push({ request, payment: reply.payment, refund: reply.refund });
    }
  }
  if (requests.length && !confirmed.length) {
    throw new Error("Payment module did not confirm any requested refund");
  }
  return confirmed;
}

function keyedReplay(payment, request, equal) {
  return Boolean(request?.idempotency_key && payment.refunds?.some(row =>
    row.idempotency_key === request.idempotency_key && row.status === "succeeded" &&
    equal(row.raw_amount ?? row.amount, request.amount)));
}

// Only fresh approvals consume the remaining balance. A replay can appear
// before or after a new partial for the same payment in one workflow call.
function freshAllAmount(payment, requests, math, invalid) {
  const keyedAmounts = new Map();
  let fresh = math.convert(0);
  for (const request of requests) {
    const amount = math.convert(request.amount ?? payment.raw_amount ?? payment.amount);
    if (!amount.isInteger() || !amount.isPositive() || amount.gt(Number.MAX_SAFE_INTEGER)) throw invalid();
    const key = request.idempotency_key;
    if (key) {
      if (keyedAmounts.has(key)) {
        if (!math.eq(keyedAmounts.get(key), amount)) throw invalid();
        continue;
      }
      keyedAmounts.set(key, amount);
      if (keyedReplay(payment, {idempotency_key: key, amount}, math.eq)) continue;
    }
    fresh = math.add(fresh, amount);
  }
  return fresh;
}

async function checkLegacyReferences(db, requests) {
  const ids = [...new Set(requests.map(request => request.payment_id))];
  if (!ids.length) return;
  const legacy = await db("order_transaction").where({ reference: "refund" })
    .whereIn("reference_id", ids).whereNull("deleted_at").first("id");
  if (legacy) throw new Error("Existing payment-level refund posting requires reconciliation");
}

module.exports = Object.assign(confirmedRefunds, { withReceipt, writerResult, keyedReplay, freshAllAmount, checkLegacyReferences });
