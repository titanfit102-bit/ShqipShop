import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../app/api/client';
import { blockAuthForLogin } from '../app/api/auth-token-storage';
import { CartProvider } from '../app/data/cart-context';
import { ORDER_COMPLETION_PENDING_KEY } from '../app/data/order-completion-recovery';
import Cart from '../app/screens/cart';

const cartId = 'cart_recovery123';
const orderId = 'order_recovery123';
const mockBackend = 'https://merchant-a.example.invalid';
const mockOwner = 'cus_recovery123';
const mockedNavigation = { navigate: jest.fn(), isFocused: () => true };
let mockRecover: (() => Promise<void>) | undefined;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

jest.mock('../app/api/client', () => ({
  __esModule: true,
  default: {
    client: { fetch: jest.fn() },
    store: { order: { retrieve: jest.fn() }, cart: { create: jest.fn() } },
  },
}));
jest.mock('../app/data/native-checkout-recovery', () => ({
  nativeCheckoutRecoveryEnabled: true,
  nativeCheckoutRecoveryScope: (customerId?: string) =>
    customerId ? { backend: mockBackend, customerId } : undefined,
}));
jest.mock('../app/data/region-context', () => ({
  useRegion: () => ({ region: { id: 'reg_demo' } }),
}));
jest.mock('../app/data/customer-context', () => ({
  useCustomer: () => ({ customer: { id: mockOwner } }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockedNavigation,
}));
jest.mock('@fluent/react', () => ({
  useLocalization: () => ({ l10n: { getString: (key: string) => key } }),
}));
jest.mock('../app/components/common/button', () => ({
  __esModule: true,
  default: ({ title, onPress }: { title: string; onPress: () => Promise<void> }) => {
    if (title === 'check-order-status') mockRecover = onPress;
    return null;
  },
}));
jest.mock('../app/components/common/text', () => () => null);
jest.mock('../app/components/common/navbar', () => () => null);
jest.mock('../app/components/cart/cart-content', () => () => null);

const outcome = apiClient.client.fetch as jest.Mock;
const receipt = apiClient.store.order.retrieve as jest.Mock;
const replacement = apiClient.store.cart.create as jest.Mock;
const marker = (backend = mockBackend, customerId = mockOwner) =>
  JSON.stringify({ cartId, backend, customerId });

async function mount(savedMarker = marker()) {
  await AsyncStorage.setItem(ORDER_COMPLETION_PENDING_KEY, savedMarker);
  await AsyncStorage.setItem('cart_id', cartId);
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<CartProvider><Cart /></CartProvider>);
  });
  expect(mockRecover).toBeDefined();
}

async function press() {
  await ReactTestRenderer.act(async () => { await mockRecover?.(); });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockRecover = undefined;
  replacement.mockResolvedValue({ cart: { id: 'cart_replacement', region_id: 'reg_demo' } });
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => renderer?.unmount());
  renderer = undefined;
});

test('the mounted Cart checks a receipt before releasing the pending cart and navigating', async () => {
  outcome.mockResolvedValue({ state: 'confirmed', order_id: orderId });
  receipt.mockResolvedValue({ order: { id: orderId } });
  await mount();
  await press();
  expect(outcome).toHaveBeenCalledWith(
    `/store/shqipshop/order-recovery-ci?cart_id=${cartId}`, { method: 'GET' },
  );
  expect(receipt).toHaveBeenCalledWith(orderId);
  expect(await AsyncStorage.getItem(ORDER_COMPLETION_PENDING_KEY)).toBeNull();
  expect(mockedNavigation.navigate).toHaveBeenCalledWith('OrderDetail', { orderId });
});

test('the mounted Cart clears a sealed attempt without opening a receipt', async () => {
  outcome.mockResolvedValue({ state: 'no_order' });
  await mount();
  await press();
  expect(await AsyncStorage.getItem(ORDER_COMPLETION_PENDING_KEY)).toBeNull();
  expect(receipt).not.toHaveBeenCalled();
  expect(mockedNavigation.navigate).not.toHaveBeenCalled();
});

test('unknown and a mismatched receipt leave the original cart pending', async () => {
  outcome.mockResolvedValueOnce({ state: 'unknown' })
    .mockResolvedValueOnce({ state: 'confirmed', order_id: orderId });
  receipt.mockResolvedValue({ order: { id: 'order_other123' } });
  await mount();
  await press();
  await press();
  expect(await AsyncStorage.getItem(ORDER_COMPLETION_PENDING_KEY)).toBe(marker());
  expect(await AsyncStorage.getItem('cart_id')).toBe(cartId);
  expect(replacement).not.toHaveBeenCalled();
  expect(mockedNavigation.navigate).not.toHaveBeenCalled();
});

test.each([
  cartId,
  marker(mockBackend, 'cus_different123'),
  marker('https://merchant-b.example.invalid'),
])('the mounted Cart does not send legacy or out-of-scope markers to Medusa', async savedMarker => {
  await mount(savedMarker);
  await press();
  expect(outcome).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(ORDER_COMPLETION_PENDING_KEY)).toBe(savedMarker);
});

test('an authentication change while recovery awaits Medusa prevents cleanup and navigation', async () => {
  let finish!: (value: unknown) => void;
  outcome.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount();
  let check: Promise<void> | undefined;
  await ReactTestRenderer.act(async () => { check = mockRecover?.(); });
  await ReactTestRenderer.act(async () => {
    blockAuthForLogin();
    finish({ state: 'confirmed', order_id: orderId });
    await check;
  });
  expect(receipt).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('cart_id')).toBe(cartId);
  expect(await AsyncStorage.getItem(ORDER_COMPLETION_PENDING_KEY)).toBe(marker());
  expect(mockedNavigation.navigate).not.toHaveBeenCalled();
});
