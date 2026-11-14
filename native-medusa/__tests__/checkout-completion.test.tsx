import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../app/api/client';
import Checkout from '../app/screens/checkout';
import { ORDER_COMPLETION_PENDING_KEY } from '../app/data/order-completion-recovery';

const mockDisk = new Map<string, string>();
const mockCart = {
  id: 'cart_A',
  region_id: 'reg_al',
  email: 'guest@example.invalid',
  items: [{ id: 'line_1' }],
  shipping_address: { address_1: 'Synthetic street' },
  shipping_methods: [{ shipping_option_id: 'so_1' }],
  payment_collection: {
    payment_sessions: [{ provider_id: 'pp_system_default', status: 'authorized' }],
  },
};
let mockPress: (() => void) | undefined;
const mockNav = { dispatch: jest.fn() };
const mockCartReset = jest.fn(async () => undefined);
const mockRetryCart = jest.fn();
const mockRunCompletion = jest.fn(async (task: (cart: typeof mockCart) => Promise<string>) => {
  const orderId = await task(mockCart);
  await mockCartReset();
  return { orderId, cartId: mockCart.id };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockDisk.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockDisk.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { mockDisk.delete(key); }),
  },
}));
jest.mock('../app/api/client', () => ({
  __esModule: true,
  default: { store: { cart: { complete: jest.fn() } } },
}));
jest.mock('../app/data/cart-context', () => ({
  useCart: () => ({
    cart: mockCart,
    runCurrentCartCompletion: mockRunCompletion,
    retryCart: mockRetryCart,
  }),
}));
jest.mock('@fluent/react', () => ({
  useLocalization: () => ({ l10n: { getString: (key: string) => key } }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  CommonActions: { reset: (value: unknown) => value },
}));
jest.mock('../app/data/hooks', () => ({
  useCountries: () => [],
  useCurrentCheckoutStep: () => 'review',
  useActivePaymentSession: () => ({ provider_id: 'pp_system_default' }),
}));
jest.mock('../app/components/common/button', () => ({
  __esModule: true,
  default: (props: { onPress: () => void }) => { mockPress = props.onPress; return null; },
}));
jest.mock('../app/components/common/navbar', () => () => null);
jest.mock('../app/components/checkout/checkout-steps', () => () => null);
jest.mock('../app/components/checkout/steps/address-step', () => () => null);
jest.mock('../app/components/checkout/steps/shipping-step', () => () => null);
jest.mock('../app/components/checkout/steps/payment-step', () => () => null);
jest.mock('../app/components/checkout/steps/review-step', () => () => null);

const complete = apiClient.store.cart.complete as jest.Mock;
const alert = jest.spyOn(require('react-native').Alert, 'alert');
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
const press = async () => {
  const invoke = mockPress;
  expect(invoke).toBeDefined();
  await ReactTestRenderer.act(async () => { await invoke?.(); });
};
beforeEach(() => {
  jest.clearAllMocks();
  mockDisk.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (key: string) => mockDisk.get(key) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (key: string, value: string) => { mockDisk.set(key, value); },
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    async (key: string) => { mockDisk.delete(key); },
  );
  mockPress = undefined;
});
afterEach(async () => {
  if (renderer) await ReactTestRenderer.act(async () => renderer?.unmount());
  renderer = undefined;
});
const mount = async () => {
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<Checkout />); });
  expect(mockPress).toBeDefined();
};

test('N03 acknowledged order resets the exact cart, clears journal, and navigates once', async () => {
  complete.mockResolvedValue({ type: 'order', order: { id: 'order_A' } });
  await mount();
  await press();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledWith('cart_A');
  expect(mockCartReset).toHaveBeenCalledTimes(1);
  expect(mockDisk.has(ORDER_COMPLETION_PENDING_KEY)).toBe(false);
  expect(mockRetryCart).toHaveBeenCalledTimes(1);
  expect(mockNav.dispatch).toHaveBeenCalledWith({
    index: 0,
    routes: [
      { name: 'Main' },
      { name: 'OrderDetail', params: { orderId: 'order_A', cartProof: 'cart_A' } },
    ],
  });
  expect(alert).not.toHaveBeenCalled();
});

test('N03 explicit Medusa type=cart no-order result releases the marker for a safe retry', async () => {
  complete.mockResolvedValueOnce({
    type: 'cart', error: { message: 'synthetic payment not completed' },
  }).mockResolvedValueOnce({ type: 'order', order: { id: 'order_B' } });
  await mount();
  await press();
  expect(mockDisk.has(ORDER_COMPLETION_PENDING_KEY)).toBe(false);
  expect(mockCartReset).not.toHaveBeenCalled();
  expect(mockNav.dispatch).not.toHaveBeenCalled();
  await press();
  expect(complete).toHaveBeenCalledTimes(2);
  expect(mockCartReset).toHaveBeenCalledTimes(1);
  expect(mockDisk.has(ORDER_COMPLETION_PENDING_KEY)).toBe(false);
});

test('N03 lost acknowledgement never triggers a second complete on user retry', async () => {
  complete.mockRejectedValue(new Error('synthetic response lost after server commit'));
  await mount();
  await press();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(mockDisk.get(ORDER_COMPLETION_PENDING_KEY)).toBe('cart_A');
  expect(mockCartReset).not.toHaveBeenCalled();
  expect(mockNav.dispatch).not.toHaveBeenCalled();
  await press();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(mockDisk.get(ORDER_COMPLETION_PENDING_KEY)).toBe('cart_A');
  expect(alert).toHaveBeenCalledWith('error', 'order-confirmation-pending');
});
