import type { HttpTypes } from '@medusajs/types';
import { CART_STORAGE_KEY, restoreOrCreateCart } from '../app/data/cart-recovery';

const cart = (id: string, region_id = 'reg_al') =>
  ({ id, region_id } as HttpTypes.StoreCart);

function fixture(saved: string | null) {
  let persisted = saved;
  const storage = {
    getItem: jest.fn(async (key: string) => key === CART_STORAGE_KEY ? persisted : null),
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

test('N01 reboot with reset tombstone must not retrieve previously private cart', async () => {
  const disk = new Map<string, string>([
    [CART_STORAGE_KEY, 'cart_private_A'],
    ['shqipshop:cart-reset-pending', '1'],
  ]);
  const storage = {
    getItem: jest.fn(async (key: string) => disk.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { disk.set(key, value); }),
    removeItem: jest.fn(async (key: string) => {
      if (key === CART_STORAGE_KEY) throw new Error('simulated persistent remove failure');
      disk.delete(key);
    }),
  };
  const service = {
    retrieve: jest.fn(async () => ({ cart: cart('cart_private_A') })),
    update: jest.fn(),
    create: jest.fn(async () => ({ cart: cart('cart_new') })),
  };
  await expect(restoreOrCreateCart('reg_al', storage, service as never))
    .rejects.toThrow('simulated persistent remove failure');
  expect(service.retrieve).not.toHaveBeenCalled();
  expect(disk.get('shqipshop:cart-reset-pending')).toBe('1');
});

test('N03 ack-unknown cart completion blocks restore and never auto-creates replacement', async () => {
  const f = fixture('cart_maybe_completed');
  f.service.retrieve.mockRejectedValueOnce({ status: 404 });
  f.storage.getItem.mockImplementation(async (key: string) =>
    key === 'shqipshop:order-completion-pending' ? 'cart_maybe_completed' :
      key === CART_STORAGE_KEY ? 'cart_maybe_completed' : null,
  );
  await expect(restoreOrCreateCart('reg_al', f.storage, f.service))
    .rejects.toThrow(/order confirmation pending/i);
  expect(f.service.retrieve).not.toHaveBeenCalled();
  expect(f.service.create).not.toHaveBeenCalled();
  expect(f.storage.removeItem).not.toHaveBeenCalled();
  expect(f.saved).toBe('cart_maybe_completed');
});

test('N03 completion marker blocks new anonymous cart after ambiguous completion and restart', async () => {
  const f = fixture(null);
  f.storage.getItem.mockImplementation(async key =>
    key === 'shqipshop:order-completion-pending' ? 'cart_completed_unknown' : null,
  );
  await expect(restoreOrCreateCart('reg_al', f.storage, f.service))
    .rejects.toThrow(/order confirmation pending/i);
  expect(f.service.create).not.toHaveBeenCalled();
  expect(f.storage.setItem).not.toHaveBeenCalled();
});
