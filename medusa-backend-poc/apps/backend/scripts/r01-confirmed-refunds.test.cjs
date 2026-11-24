"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const confirmedRefunds = require("./r01-confirmed-refunds.cjs");

function receipt(paymentId, refundId, amount) {
  const refund = { id: refundId, amount, status: "succeeded" };
  const payment = { id: paymentId, refunds: [refund] };
  return confirmedRefunds.writerResult(confirmedRefunds.withReceipt({ payment_id: paymentId }), payment, refundId);
}

test("two approved partial refunds preserve their request amounts and order", () => {
  const requests = [{ payment_id: "payment-A", amount: 1 }, { payment_id: "payment-A", amount: 99 }];
  const replies = [receipt("payment-A", "ref_first", 1), receipt("payment-A", "ref_second", 99)];
  assert.deepEqual(confirmedRefunds(requests, replies), [
    { request: requests[0], ...replies[0] }, { request: requests[1], ...replies[1] },
  ]);
});

test("a declined partial refund cannot borrow another confirmation on the same payment", () => {
  const requests = [{ payment_id: "payment-A", amount: 20 }, { payment_id: "payment-A", amount: 30 }];
  for (const index of [0, 1]) {
    const replies = [undefined, undefined];
    replies[index] = receipt("payment-A", "ref_confirmed", requests[index].amount);
    assert.deepEqual(confirmedRefunds(requests, replies), [{ request: requests[index], ...replies[index] }]);
  }
});

test("a late decline does not return a successful workflow result", () => {
  assert.throws(() => confirmedRefunds([{ payment_id: "payment-A", amount: 1 }], [undefined]),
    /did not confirm any requested refund/);
});

test("a confirmation for another payment cannot authorize an entry", () => {
  const requests = [{ payment_id: "payment-A", amount: 3 }, { payment_id: "payment-B", amount: 4 }];
  const replies = [receipt("payment-B", "ref_other", 3), receipt("payment-B", "ref_matched", 4)];
  assert.deepEqual(confirmedRefunds(requests, replies), [{ request: requests[1], ...replies[1] }]);
});

test("missing or extra writer results fail closed", () => {
  const request = { payment_id: "payment-A", amount: 1 };
  assert.throws(() => confirmedRefunds([request], []), /Incomplete refund writer results/);
  assert.throws(() => confirmedRefunds([], [{ id: "payment-A" }]), /Incomplete refund writer results/);
});

test("an empty batch has no accounting effects", () => {
  assert.deepEqual(confirmedRefunds([], []), []);
});

test("the native refund ID distinguishes identical amounts and preserves the public DTO", () => {
  const first = { id: "ref_first", amount: 20, status: "succeeded" };
  const second = { ...first, id: "ref_second" };
  const payment = { id: "pay_a", refunds: [first, second] };
  const request = { payment_id: payment.id };
  assert.equal(confirmedRefunds.writerResult(request, payment, second.id), payment);
  const marked = confirmedRefunds.withReceipt(request);
  assert.equal(confirmedRefunds.writerResult(marked, payment, second.id).refund, second);
  assert.throws(() => confirmedRefunds.writerResult(marked, payment, "ref_missing"));
  assert.throws(() => confirmedRefunds.writerResult(marked, { ...payment, refunds: [{ ...second, status: "pending" }] }, second.id));
});
