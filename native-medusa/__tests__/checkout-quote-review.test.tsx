import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Checkout from '../app/screens/checkout';
import Button from '../app/components/common/button';
import Text from '../app/components/common/text';
import { useCart } from '../app/data/cart-context';
import apiClient from '../app/api/client';

jest.mock('@fluent/react', () => ({
  useLocalization: () => ({l10n: {getString: (key: string, args?: {amount: string}) =>
    args ? key + ' ' + args.amount : key}}),
}));
jest.mock('../app/data/cart-context', () => ({useCart: jest.fn()}));
jest.mock('../app/data/hooks', () => ({
  useCountries: () => [],
  useCurrentCheckoutStep: () => 'review',
  useActivePaymentSession: () => ({provider_id: 'pp_system_default'}),
}));
jest.mock('../app/api/client', () => ({
  __esModule: true, default: {
    client: {fetch: jest.fn()},
    store: {cart: {complete: jest.fn(), retrieve: jest.fn()}, customer: {retrieve: jest.fn()}},
  },
}));
jest.mock('../app/data/native-checkout-recovery', () => ({
  nativeCheckoutRecoveryEnabled: true,
  nativeQuoteReviewEnabled: true,
  nativeCheckoutRecoveryScope: () => ({backend: 'http://localhost:9000', customerId: 'cus_test'}),
}));
jest.mock('../app/api/auth-token-storage', () => ({
  authTokenStorage: {getItem: async () => 'test'},
  getNativeAuthVersion: () => 1,
  isCurrentAuthAttempt: () => true,
}));
jest.mock('../app/components/common/navbar', () => () => null);
jest.mock('../app/components/common/button', () => () => null);
jest.mock('../app/components/common/text', () => () => null);
jest.mock('../app/components/checkout/checkout-steps', () => () => null);
jest.mock('../app/components/checkout/steps/address-step', () => () => null);
jest.mock('../app/components/checkout/steps/shipping-step', () => () => null);
jest.mock('../app/components/checkout/steps/payment-step', () => () => null);
jest.mock('../app/components/checkout/steps/review-step', () => () => null);
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({})}));

test('a stale approval displays the new total and requests fresh consent without dispatch', async () => {
  const cart = {
    id: 'cart_test', customer_id: 'cus_test', total: 500, currency_code: 'all', items: [{id: 'item_test'}],
    payment_collection: {payment_sessions: [{provider_id:'pp_system_default', status:'pending'}]},
  };
  jest.mocked(useCart).mockReturnValue({
    cart, runCurrentCartTask: async (task: (activeCart: typeof cart) => Promise<typeof cart>) => task(cart),
    runCurrentCartCompletion: async (task: (activeCart: typeof cart) => Promise<string>) => task(cart),
  } as unknown as ReturnType<typeof useCart>);
  jest.mocked(apiClient.store.customer.retrieve).mockResolvedValue({customer:{id:'cus_test'}} as never);
  jest.mocked(apiClient.store.cart.retrieve).mockResolvedValue({cart: {...cart, total: 700}} as never);
  const fetchQuote = jest.mocked(apiClient.client.fetch);
  fetchQuote.mockResolvedValueOnce({
    quote_id:'quote_12345678-1234-1234-1234-123456789abc', fingerprint:'sha256:' + '1'.repeat(64),
    total:'500', currency:'all',
  }).mockRejectedValueOnce(Object.assign(new Error('stale'), {status:409})).mockResolvedValueOnce({
    quote_id:'quote_12345678-1234-1234-1234-123456789abd', fingerprint:'sha256:' + '2'.repeat(64),
    total:'700', currency:'all',
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<Checkout />); });
  try {
    const button = () => renderer.root.findByType(Button).props;
    expect(button().title).toBe('review-current-quote');
    await ReactTestRenderer.act(async () => { await button().onPress(); });
    expect(button().title).toBe('accept-quote-and-order');
    expect(fetchQuote).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(async () => { await button().onPress(); });
    expect(fetchQuote).toHaveBeenCalledTimes(3);
    const displayed = renderer.root.findAllByType(Text).map(node => node.props.children);
    expect(displayed).toContain('checkout-quote-changed');
    expect(displayed).toContain('checkout-quote-total 700');
    expect(apiClient.store.cart.retrieve).toHaveBeenCalledWith(cart.id, expect.anything());
    expect(apiClient.store.cart.complete).not.toHaveBeenCalled();
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});
