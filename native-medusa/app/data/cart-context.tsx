import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { HttpTypes } from '@medusajs/types';
import { useRegion } from './region-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '@api/client';
import { CART_FIELDS, isMissingCartError, restoreOrCreateCart } from './cart-recovery';

const CART_KEY = 'cart_id';

type AddressFields = {
  first_name: string;
  last_name: string;
  address_1: string;
  company?: string;
  postal_code: string;
  city: string;
  country_code: string;
  province?: string;
  phone: string;
};

type CartUpdateData = Partial<{
  email: string;
  shipping_address: AddressFields;
  billing_address: AddressFields;
  region_id: string;
}>;

type CartContextType = {
  cart?: HttpTypes.StoreCart;
  cartLoading: boolean;
  cartError?: string;
  retryCart: () => void;
  setCart: React.Dispatch<
    React.SetStateAction<HttpTypes.StoreCart | undefined>
  >;
  resetCart: () => Promise<void>;
  addToCart: (variantId: string, quantity: number) => Promise<void>;
  updateLineItem: (lineItemId: string, quantity: number) => Promise<void>;
  updateCart: (data: CartUpdateData) => Promise<HttpTypes.StoreCart>;
  linkCartToCustomer: () => Promise<void>;
  setShippingMethod: (shippingMethodId: string) => Promise<HttpTypes.StoreCart>;
  applyPromoCode: (code: string) => Promise<boolean>;
  removePromoCode: (code: string) => Promise<void>;
};

const CartContext = createContext<CartContextType | null>(null);

type CartProviderProps = {
  children: React.ReactNode;
};

export const CartProvider = ({ children }: CartProviderProps) => {
  const [cart, setCart] = useState<HttpTypes.StoreCart>();
  const { region } = useRegion();
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string>();
  const [retryKey, setRetryKey] = useState(0);
  const retryCart = () => setRetryKey(value => value + 1);

  const additionalFields = CART_FIELDS;

  const resetCart = async () => {
    await AsyncStorage.removeItem(CART_KEY);
    setCart(undefined);
  };

  const updateCart = useCallback(
    async (data: CartUpdateData) => {
      if (!cart?.id) {
        throw new Error('No cart found');
      }

      const { cart: updatedCart } = await apiClient.store.cart.update(
        cart.id,
        data,
        {
          fields: additionalFields,
        },
      );
      setCart(updatedCart);
      return updatedCart;
    },
    [cart?.id],
  );

  // Recover from a deleted/completed cart without treating an offline network as
  // a missing cart. Cancelling the effect ignores late responses from a prior region.
  useEffect(() => {
    if (!region?.id || (cart?.id && cart.region_id === region.id)) return;
    let active = true;
    setCartLoading(true);
    setCartError(undefined);
    void (async () => {
      try {
        const nextCart = await restoreOrCreateCart(region.id, AsyncStorage, apiClient.store.cart);
        if (active) setCart(nextCart);
      } catch (error) {
        if (active) {
          console.error('Cart restore unavailable:', error);
          setCartError(error instanceof Error ? error.message : 'Cart unavailable');
        }
      } finally {
        if (active) setCartLoading(false);
      }
    })();
    return () => { active = false; };
  }, [region?.id, cart?.id, cart?.region_id, retryKey]);

  const fetchCart = async (cartId: string) => {
    const { cart: restored } = await apiClient.store.cart.retrieve(cartId, {
      fields: additionalFields,
    });
    setCart(restored);
  };

  const addToCart = async (variantId: string, quantity: number) => {
    if (!cart?.id) {
      throw new Error('Cart is not available; retry recovery before adding products');
    }

    try {
      const { cart: dataCart } = await apiClient.store.cart.createLineItem(
        cart.id,
        {
          variant_id: variantId,
          quantity,
        },
      );
      setCart(dataCart);
    } catch (err) {
      console.error('Add to cart failed:', err);
      throw err;
    }
  };

  const updateLineItem = async (lineItemId: string, quantity: number) => {
    if (!cart?.id) {
      throw new Error('Cart is not available; retry recovery before editing items');
    }

    try {
      if (quantity === 0) {
        await apiClient.store.cart.deleteLineItem(cart.id, lineItemId);
        await fetchCart(cart.id);
      } else {
        const { cart: dataCart } = await apiClient.store.cart.updateLineItem(
          cart.id,
          lineItemId,
          {
            quantity,
          },
        );
        setCart(dataCart);
      }
    } catch (err) {
      console.error('Update cart item failed:', err);
      if (isMissingCartError(err)) {
        // Do not reuse a deleted cart. The next effect creates a fresh one.
        await resetCart();
      }
      throw err;
    }
  };

  const linkCartToCustomer = async () => {
    const { cart: dataCart } = await apiClient.store.cart.transferCart(
      cart?.id || '',
    );
    setCart(dataCart);
  };

  const setShippingMethod = async (shippingMethodId: string) => {
    const { cart: updatedCart } = await apiClient.store.cart.addShippingMethod(
      cart?.id || '',
      {
        option_id: shippingMethodId,
      },
      {
        fields: additionalFields,
      },
    );
    setCart(updatedCart);
    return updatedCart;
  };

  const applyPromoCode = async (code: string): Promise<boolean> => {
    if (!cart?.id) {
      throw new Error('No cart found');
    }

    try {
      const existingCodes =
        cart.promotions
          ?.filter(p => !p.is_automatic && p.code)
          .map(p => p.code!) || [];

      const { cart: updatedCart } = await apiClient.store.cart.update(cart.id, {
        promo_codes: [...existingCodes, code],
      });
      setCart(updatedCart);
      // check if updatedCart has the promo code
      const updatedCartPromoCodes = updatedCart.promotions
        ?.filter(p => p.code)
        .map(p => p.code);
      if (updatedCartPromoCodes?.includes(code)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const removePromoCode = async (code: string) => {
    if (!cart?.id) {
      throw new Error('No cart found');
    }

    try {
      const existingCodes =
        cart.promotions
          ?.filter(p => !p.is_automatic && p.code !== code)
          .map(p => p.code!) || [];

      const { cart: updatedCart } = await apiClient.store.cart.update(cart.id, {
        promo_codes: existingCodes,
      });
      setCart(updatedCart);
    } catch (err) {
      throw err;
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        cartLoading,
        cartError,
        retryCart,
        setCart,
        resetCart,
        addToCart,
        updateLineItem,
        updateCart,
        linkCartToCustomer,
        setShippingMethod,
        applyPromoCode,
        removePromoCode,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
};

// Export types for reuse in other components
export type { AddressFields, CartUpdateData };
