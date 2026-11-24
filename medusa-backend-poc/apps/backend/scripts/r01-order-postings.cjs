"use strict";

function isRefundBatch(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every(row =>
    row.reference === "refund" && typeof row.reference_id === "string" && row.reference_id.startsWith("ref_"));
}

// Called inside the native Order Module transaction that also updates the
// order summary. Lock orders in the same order across multi-order batches.
async function missingPostings(rows, context, equal) {
  const tx = context.transactionManager?.getTransactionContext();
  if (!tx) throw new Error("Refund postings require the order writer transaction");
  const orderIds = [...new Set(rows.map(row => row.order_id))].sort();
  const orders = await tx("order").whereIn("id", orderIds).whereNull("deleted_at")
    .orderBy("id").forUpdate().select("id");
  if (orders.length !== orderIds.length) throw new Error("Refund order unavailable");

  const prior = await tx("order_transaction").where({ reference: "refund" }).whereNull("deleted_at")
    .whereIn("order_id", orderIds).whereIn("reference_id", rows.map(row => row.reference_id))
    .select("order_id", "reference_id", "currency_code", "amount");
  const key = row => JSON.stringify([row.order_id, row.reference_id]);
  const seen = new Map();
  for (const row of prior) {
    if (seen.has(key(row))) throw new Error("Duplicate existing order refund postings");
    seen.set(key(row), row);
  }
  const pending = [];
  for (const row of rows) {
    const existing = seen.get(key(row));
    if (existing) {
      if (existing.currency_code !== row.currency_code || !equal(existing.amount, row.amount)) {
        throw new Error("Existing order posting disagrees with the confirmed refund");
      }
    } else {
      seen.set(key(row), row);
      pending.push(row);
    }
  }
  return pending;
}

module.exports = { isRefundBatch, missingPostings };
