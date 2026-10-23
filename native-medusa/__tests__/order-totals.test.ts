import { getOrderProductsSubtotal } from '../app/utils/order-totals';

test('receipt never mistakes shipping-inclusive order.subtotal for product subtotal', () => {
  const order = {
    item_subtotal: 1500,
    subtotal: 1510,
    shipping_total: 10,
    total: 1510,
    items: [{ unit_price: 1500, quantity: 1 }],
  };
  expect(getOrderProductsSubtotal(order)).toBe(1500);
  expect(getOrderProductsSubtotal(order)! + order.shipping_total).toBe(order.total);
});

test('prefers actual line subtotal over list unit price when item_subtotal absent', () => {
  expect(getOrderProductsSubtotal({
    items: [
      { subtotal: 700, unit_price: 800, quantity: 1 },
      { subtotal: 1000, unit_price: 500, quantity: 2 },
    ],
  })).toBe(1700);
});

test('supports older order payloads with unit price and quantity only', () => {
  expect(getOrderProductsSubtotal({
    items: [{ unit_price: 1500, quantity: 1 }],
  })).toBe(1500);
});

test('does not invent amounts if order lines contain missing or invalid numbers', () => {
  expect(getOrderProductsSubtotal({ items: [] })).toBeNull();
  expect(getOrderProductsSubtotal({ items: [{ quantity: 1 }] })).toBeNull();
  expect(getOrderProductsSubtotal({ items: [{ unit_price: NaN, quantity: 1 }] })).toBeNull();
});
