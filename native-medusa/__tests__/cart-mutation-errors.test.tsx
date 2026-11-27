import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import apiClient from '../app/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartProvider, useCart } from '../app/data/cart-context';

jest.mock('../app/api/client', () => ({
  __esModule: true,
  default: {
    store: {
      cart: {
        createLineItem: jest.fn(),
        updateLineItem: jest.fn(),
        deleteLineItem: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        transferCart: jest.fn(),
      },
    },
  },
}));
jest.mock('../app/data/region-context', () => ({
  useRegion: () => ({ region: undefined }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

let cartActions: ReturnType<typeof useCart> | undefined;
function Probe() {
  cartActions = useCart();
  return null;
}
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  if (renderer) await ReactTestRenderer.act(async () => renderer?.unmount());
  renderer = undefined;
  jest.clearAllMocks();
});

async function renderWithCart() {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<CartProvider><Probe /></CartProvider>);
  });
  await ReactTestRenderer.act(async () => {
    cartActions?.setCart({ id: 'cart_1', items: [{id:'li_1',quantity:1}] } as never);
  });
}

test('add to cart rejects offline/5xx rather than reporting success', async () => {
  await renderWithCart();
  const failed = new Error('HTTP 503 offline');
  jest.mocked(apiClient.store.cart.createLineItem).mockRejectedValueOnce(failed);
  await expect(cartActions?.addToCart('variant_test', 1)).rejects.toThrow('HTTP 503 offline');
  expect(cartActions?.cart?.items?.[0]?.quantity).toBe(1);
});

test('update quantity rejects server failures and preserves old cart state', async () => {
  await renderWithCart();
  jest.mocked(apiClient.store.cart.updateLineItem).mockRejectedValueOnce(new Error('HTTP 500'));
  await expect(cartActions?.updateLineItem('li_1', 2)).rejects.toThrow('HTTP 500');
  expect(cartActions?.cart?.items?.[0]?.quantity).toBe(1);
});

test('no cart rejects mutations instead of silently succeeding', async () => {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<CartProvider><Probe /></CartProvider>);
  });
  await expect(cartActions?.addToCart('variant_test', 1)).rejects.toThrow('Cart is not available');
  await expect(cartActions?.updateLineItem('li_1', 1)).rejects.toThrow('Cart is not available');
});

test('N01 stale update from cart A cannot restore private PII after reset and guest switch', async () => {
  await renderWithCart();
  const cartA = {
    id: 'cart_A',
    region_id: 'reg_al',
    email: 'private-A@example.invalid',
    shipping_address: { address_1: 'SYNTHETIC PRIVATE A' },
  };
  await ReactTestRenderer.act(async () => { cartActions?.setCart(cartA as never); });

  let finishUpdate!: (result: { cart: never }) => void;
  jest.mocked(apiClient.store.cart.update).mockImplementationOnce(
    () => new Promise<{ cart: never }>(resolve => { finishUpdate = resolve; }) as never,
  );

  let pending!: Promise<unknown>;
  await ReactTestRenderer.act(async () => {
    pending = cartActions!.updateCart({ email: 'private-A@example.invalid' });
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    await cartActions!.resetCart();
    cartActions!.setCart({ id: 'cart_guest_1', region_id: 'reg_al' } as never);
  });
  await ReactTestRenderer.act(async () => {
    finishUpdate({ cart: cartA as never });
    await pending;
  });

  expect(cartActions?.cart?.id).toBe('cart_guest_1');
  expect(cartActions?.cart?.email).toBeUndefined();
  expect(JSON.stringify(renderer?.toJSON())).not.toContain('SYNTHETIC PRIVATE A');
});

test('N01 reset hides private cart even when persisted cart ID removal fails', async () => {
  await renderWithCart();
  await ReactTestRenderer.act(async () => {
    cartActions?.setCart({
      id: 'cart_A',
      region_id: 'reg_al',
      email: 'private-A@example.invalid',
    } as never);
  });

  (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
    new Error('synthetic disk failure'),
  );
  await ReactTestRenderer.act(async () => {
    await expect(cartActions!.resetCart()).rejects.toThrow('synthetic disk failure');
  });
  expect(cartActions?.cart).toBeUndefined();
});

test('N01 stale customer transfer cannot overwrite a new guest cart', async () => {
  await renderWithCart();
  let finishTransfer!: (result: { cart: never }) => void;
  jest.mocked(apiClient.store.cart.transferCart).mockImplementationOnce(
    () => new Promise<{ cart: never }>(resolve => { finishTransfer = resolve; }) as never,
  );
  let pending!: Promise<void>;
  await ReactTestRenderer.act(async () => {
    pending = cartActions!.linkCartToCustomer();
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    await cartActions!.resetCart();
    cartActions!.setCart({ id: 'cart_guest_2', region_id: 'reg_al' } as never);
  });
  await ReactTestRenderer.act(async () => {
    finishTransfer({ cart: { id: 'cart_1', email: 'private-A@example.invalid' } as never });
    await pending;
  });
  expect(cartActions?.cart?.id).toBe('cart_guest_2');
  expect(cartActions?.cart?.email).toBeUndefined();
});

test('N01 legitimate matching cart mutation still updates active cart', async () => {
  await renderWithCart();
  const activeCart = {
    id: 'cart_1',
    region_id: 'reg_al',
    email: 'guest-checkout@example.invalid',
    items: [{ id: 'li_1', quantity: 1 }],
  };
  jest.mocked(apiClient.store.cart.update).mockResolvedValueOnce({
    cart: activeCart as never,
  });
  await ReactTestRenderer.act(async () => {
    const response = await cartActions!.updateCart({
      email: 'guest-checkout@example.invalid',
    });
    expect(response.id).toBe('cart_1');
  });
  expect(cartActions?.cart?.id).toBe('cart_1');
  expect(cartActions?.cart?.email).toBe('guest-checkout@example.invalid');
});

test('N01 reset persists a tombstone before attempting to delete saved cart ID', async () => {
  await renderWithCart();
  (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
    new Error('synthetic cart ID write failure'),
  );
  await ReactTestRenderer.act(async () => {
    await expect(cartActions!.resetCart()).rejects.toThrow('synthetic cart ID write failure');
  });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'shqipshop:cart-reset-pending', '1',
  );
  expect(cartActions?.cart).toBeUndefined();
});

test('N01 checkout task rejects stale A session after reset/guest replacement', async () => {
  await renderWithCart();
  const cartA = { id: 'cart_1', email: 'private-A@example.invalid', region_id: 'reg_al' };
  let complete!: (cart: never) => void;
  let pending!: Promise<unknown>;
  await ReactTestRenderer.act(async () => {
    pending = cartActions!.runCurrentCartTask(
      () => new Promise(resolve => { complete = resolve; }),
    );
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    await cartActions!.resetCart();
    cartActions!.setCart({ id: 'cart_guest_after_logout', region_id: 'reg_al' } as never);
  });
  await ReactTestRenderer.act(async () => {
    complete(cartA as never);
    await expect(pending).rejects.toThrow('Cart changed during checkout');
  });
  expect(cartActions?.cart?.id).toBe('cart_guest_after_logout');
  expect(cartActions?.cart?.email).toBeUndefined();
});

test('N01 checkout task accepts a validated current-cart response for guest', async () => {
  await renderWithCart();
  await ReactTestRenderer.act(async () => {
    const committed = await cartActions!.runCurrentCartTask(async initial => ({
      ...initial, email: 'guest-checkout@example.invalid',
    }));
    expect(committed.id).toBe('cart_1');
  });
  expect(cartActions?.cart?.email).toBe('guest-checkout@example.invalid');
});
