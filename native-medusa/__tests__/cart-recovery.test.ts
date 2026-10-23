import type { HttpTypes } from '@medusajs/types';
import { CART_STORAGE_KEY, restoreOrCreateCart } from '../app/data/cart-recovery';

const cart = (id: string, region_id = 'reg_al') =>
  ({ id, region_id } as HttpTypes.StoreCart);

function fixture(saved: string | null) {
  let persisted = saved;
  const storage = {
    getItem: jest.fn(async (_key: string) => persisted),
    setItem: jest.fn(async (_key: string, value: string) => { persisted = value; }),
    removeItem: jest.fn(async (_key: string) => { persisted = null; }),
  };
  const service = {
    retrieve: jest.fn(async (_id: string, _query: { fields: string }) => ({ cart: cart(saved ?? '') })),
    create: jest.fn(async (_data: { region_id: string }) => ({ cart: cart('cart_new') })),
    update: jest.fn(async (_id: string, data: { region_id: string }, _query: { fields: string }) =>
      ({ cart: cart(saved ?? '', data.region_id) })),
  };
  return { storage, service, get saved() { return persisted; } };
}

test.each([404,410])('expired cart %s is discarded and a new cart is saved', async status => {
  const f = fixture('cart_stale');
  f.service.retrieve.mockRejectedValueOnce({ status });
  const recovered = await restoreOrCreateCart('reg_al', f.storage, f.service);
  expect(recovered.id).toBe('cart_new');
  expect(f.storage.removeItem).toHaveBeenCalledWith(CART_STORAGE_KEY);
  expect(f.storage.setItem).toHaveBeenCalledWith(CART_STORAGE_KEY, 'cart_new');
  expect(f.saved).toBe('cart_new');
});

test.each([500,503,401])('transient/auth error %s keeps original cart and surfaces failure', async status => {
  const f = fixture('cart_keep');
  f.service.retrieve.mockRejectedValueOnce({ status });
  await expect(restoreOrCreateCart('reg_al', f.storage, f.service)).rejects.toMatchObject({status});
  expect(f.saved).toBe('cart_keep');
  expect(f.service.create).not.toHaveBeenCalled();
  expect(f.storage.removeItem).not.toHaveBeenCalled();
});

test('offline failure preserves the cart for retry', async () => {
  const f = fixture('cart_offline');
  f.service.retrieve.mockRejectedValueOnce(new Error('Network unavailable'));
  await expect(restoreOrCreateCart('reg_al', f.storage, f.service)).rejects.toThrow('Network unavailable');
  expect(f.saved).toBe('cart_offline');
  expect(f.service.create).not.toHaveBeenCalled();
});

test('empty saved cart creates one and matching region reuses existing', async () => {
  const empty = fixture(null);
  expect((await restoreOrCreateCart('reg_al', empty.storage, empty.service)).id).toBe('cart_new');
  expect(empty.service.retrieve).not.toHaveBeenCalled();
  const existing = fixture('cart_existing');
  expect((await restoreOrCreateCart('reg_al', existing.storage, existing.service)).id).toBe('cart_existing');
  expect(existing.service.create).not.toHaveBeenCalled();
});

test('region mismatch safely updates recovered cart without replacing it', async () => {
  const f = fixture('cart_existing');
  f.service.retrieve.mockResolvedValueOnce({ cart: cart('cart_existing', 'reg_old') });
  const updated = await restoreOrCreateCart('reg_new', f.storage, f.service);
  expect(updated.region_id).toBe('reg_new');
  expect(f.service.update).toHaveBeenCalledWith('cart_existing', {region_id:'reg_new'}, expect.any(Object));
  expect(f.saved).toBe('cart_existing');
});
