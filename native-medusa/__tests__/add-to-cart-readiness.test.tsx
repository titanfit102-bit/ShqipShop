import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Button from '../app/components/common/button';
import AnimatedCartButton from '../app/components/cart/animated-cart-button';
import { useCart } from '../app/data/cart-context';

jest.mock('../app/data/cart-context', () => ({ useCart: jest.fn() }));
jest.mock('../app/data/hooks', () => ({ useProductQuantity: () => 0 }));
jest.mock('@fluent/react', () => ({
  useLocalization: () => ({ l10n: { getString: (key: string) => key } }),
}));
jest.mock('@react-native-vector-icons/ant-design', () => () => null);
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockNavigate = jest.fn();
const addToCart = jest.fn();
const useMockCart = (state: Partial<ReturnType<typeof useCart>>) => {
  jest.mocked(useCart).mockReturnValue({ addToCart, ...state } as ReturnType<typeof useCart>);
};

let renderer: ReactTestRenderer.ReactTestRenderer;
const product = (
  <AnimatedCartButton productId="prod_shorts" selectedVariantId="variant_small"
    inStock hasSelectedAllOptions />
);

afterEach(async () => {
  await ReactTestRenderer.act(async () => renderer?.unmount());
  jest.clearAllMocks();
});

async function render() {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(product);
  });
}

const button = () => renderer.root.findByType(Button).props;

test('waits for cart restoration before adding a selected product', async () => {
  useMockCart({ cartLoading: true });
  await render();
  expect(button()).toMatchObject({ disabled: true, loading: true });
  await ReactTestRenderer.act(async () => { await button().onPress(); });
  expect(addToCart).not.toHaveBeenCalled();

  useMockCart({ cart: { id: 'cart_ready' } as NonNullable<ReturnType<typeof useCart>['cart']> });
  await ReactTestRenderer.act(async () => {
    renderer.update(React.cloneElement(product));
  });
  expect(button()).toMatchObject({ disabled: false, loading: false });
  await ReactTestRenderer.act(async () => { await button().onPress(); });
  expect(addToCart).toHaveBeenCalledTimes(1);
  expect(addToCart).toHaveBeenCalledWith('variant_small', 1);
});

test('opens cart recovery when cart restoration reports an error', async () => {
  useMockCart({ cartError: 'Synthetic cart restore failure' });
  await render();
  expect(button().title).toBe('view-cart');
  expect(button().disabled).not.toBe(true);
  await ReactTestRenderer.act(async () => { await button().onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith('Cart');
  expect(addToCart).not.toHaveBeenCalled();
});
