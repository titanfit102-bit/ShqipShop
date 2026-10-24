import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import apiClient from '../app/api/client';
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
