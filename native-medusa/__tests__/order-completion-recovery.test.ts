import {
  ORDER_COMPLETION_PENDING_KEY,
  ORDER_COMPLETION_PENDING_MESSAGE,
  reserveOrderCompletion,
  clearKnownOrderCompletion,
} from '../app/data/order-completion-recovery';

const fixture = () => {
  const disk = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => disk.get(key) ?? null),
    setItem: jest.fn(async (key: string, val: string) => { disk.set(key, val); }),
    removeItem: jest.fn(async (key: string) => { disk.delete(key); }),
  };
  return { disk, storage };
};

test('N03 reservation persists original cart ID before any complete request and blocks double tap', async () => {
  const { storage, disk } = fixture();
  const first = reserveOrderCompletion('cart_A', storage);
  const second = reserveOrderCompletion('cart_A', storage);
  await expect(second).rejects.toThrow(ORDER_COMPLETION_PENDING_MESSAGE);
  await first;
  expect(disk.get(ORDER_COMPLETION_PENDING_KEY)).toBe('cart_A');
  await expect(reserveOrderCompletion('cart_B', storage)).rejects.toThrow(ORDER_COMPLETION_PENDING_MESSAGE);
  await clearKnownOrderCompletion('cart_A', storage);
  expect(disk.has(ORDER_COMPLETION_PENDING_KEY)).toBe(false);
  await reserveOrderCompletion('cart_B', storage);
  expect(disk.get(ORDER_COMPLETION_PENDING_KEY)).toBe('cart_B');
});

test('N03 existing pending marker from process restart blocks new completion without altering disk', async () => {
  const { storage, disk } = fixture();
  disk.set(ORDER_COMPLETION_PENDING_KEY, 'cart_OLD');
  await expect(reserveOrderCompletion('cart_NEW', storage))
    .rejects.toThrow(ORDER_COMPLETION_PENDING_MESSAGE);
  expect(disk.get(ORDER_COMPLETION_PENDING_KEY)).toBe('cart_OLD');
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('N03 disk write failure denies completion rather than submitting without durable proof', async () => {
  const { storage, disk } = fixture();
  storage.setItem.mockRejectedValueOnce(new Error('synthetic disk error'));
  await expect(reserveOrderCompletion('cart_A', storage)).rejects.toThrow('synthetic disk error');
  expect(disk.has(ORDER_COMPLETION_PENDING_KEY)).toBe(false);
  await expect(reserveOrderCompletion('cart_A', storage))
    .rejects.toThrow(ORDER_COMPLETION_PENDING_MESSAGE);
});

test('N03 only the exact originating cart can clear a pending completion', async () => {
  const { storage, disk } = fixture();
  await reserveOrderCompletion('cart_A', storage);
  await expect(clearKnownOrderCompletion('cart_B', storage))
    .rejects.toThrow(ORDER_COMPLETION_PENDING_MESSAGE);
  expect(disk.get(ORDER_COMPLETION_PENDING_KEY)).toBe('cart_A');
  await clearKnownOrderCompletion('cart_A', storage);
  expect(disk.has(ORDER_COMPLETION_PENDING_KEY)).toBe(false);
});
