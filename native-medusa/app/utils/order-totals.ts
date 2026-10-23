/** Native order receipt maths: Medusa order.subtotal may include shipping.
 * Prefer item_subtotal, falling back only to genuine line amounts.
 */
type OrderLine = {
  subtotal?: number | null;
  unit_price?: number | null;
  quantity?: number | null;
};
type OrderLike = {
  item_subtotal?: number | null;
  items?: OrderLine[] | null;
};
const valid = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const getOrderProductsSubtotal = (order: OrderLike): number | null => {
  if (valid(order.item_subtotal)) return order.item_subtotal;
  const items = order.items;
  if (!items?.length) return null;

  let result = 0;
  for (const item of items) {
    if (valid(item.subtotal)) {
      result += item.subtotal;
    } else if (valid(item.unit_price) && valid(item.quantity)) {
      result += item.unit_price * item.quantity;
    } else {
      return null;
    }
  }
  return Number.isFinite(result) ? result : null;
};
