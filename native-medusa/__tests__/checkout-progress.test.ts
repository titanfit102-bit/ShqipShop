import type { HttpTypes } from '@medusajs/types';
import { checkoutResumeStep, activeCheckoutPaymentSession } from '../app/data/checkout-progress';

const base = {
  email: 'synthetic@example.invalid',
  shipping_address: { address_1: 'Synthetic street' },
  shipping_methods: [{ shipping_option_id: 'so_1' }],
  total: 1510,
} as unknown as HttpTypes.StoreCart;
const session = (status: string, provider_id = 'pp_system_default') => ({
  payment_collection: { payment_sessions: [{ status, provider_id }] },
}) as unknown as HttpTypes.StoreCart;

test('checkout resumes at address or delivery if mandatory details are absent', () => {
  expect(checkoutResumeStep(undefined)).toBe('address');
  expect(checkoutResumeStep({ ...base, email: '' })).toBe('address');
  expect(checkoutResumeStep({ ...base, shipping_methods: [] })).toBe('delivery');
});

test.each([0,1510])('cart total %s without a real session MUST resume at payment', total => {
  expect(checkoutResumeStep({ ...base, total })).toBe('payment');
});

test.each(['pending','authorized'])('verified %s payment session permits review', status => {
  expect(checkoutResumeStep({ ...base, ...session(status) })).toBe('review');
  expect(activeCheckoutPaymentSession({ ...base, ...session(status) })?.provider_id).toBe('pp_system_default');
});

test.each(['cancelled','error','requires_more','refunded'])('invalid %s session cannot skip payment', status => {
  expect(checkoutResumeStep({ ...base, ...session(status) })).toBe('payment');
});
