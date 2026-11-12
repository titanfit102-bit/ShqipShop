import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { HttpTypes } from '@medusajs/types';
import { useRegion } from './region-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '@api/client';
import { CART_FIELDS, CART_RESET_PENDING_KEY, isMissingCartError, restoreOrCreateCart } from './cart-recovery';

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
  runCurrentCartTask: (
    task: (activeCart: HttpTypes.StoreCart) => Promise<HttpTypes.StoreCart>,
  ) => Promise<HttpTypes.StoreCart>;
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
  const currentCartRef = useRef(cart);
  currentCartRef.current = cart;
  // A reset/logout invalidates responses issued for the previous cart identity.
  const cartGeneration = useRef(0);
  // Queue restore writes and reset removal: no stale restore may resurrect disk ID.
  const storageWriteTail = useRef<Promise<void>>(Promise.resolve());
  const queueCartStorageWrite = useCallback((operation: () => Promise<void>) => {
    const next = storageWriteTail.current.catch(() => undefined).then(operation);
    storageWriteTail.current = next.catch(() => undefined);
    return next;
  }, []);
  const commitIfCurrent = useCallback((
    updated: HttpTypes.StoreCart,
    sourceCartId: string,
    generation: number,
  ) => {
    if (generation !== cartGeneration.current) return;
    setCart(previous => (
      generation === cartGeneration.current && previous?.id === sourceCartId
        ? updated
        : previous
    ));
  }, []);
  const [resetting, setResetting] = useState(false);
  // A failed disk removal cannot automatically restore the old private cart.
  const [resetFailed, setResetFailed] = useState(false);

  const { region } = useRegion();
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string>();
  const [retryKey, setRetryKey] = useState(0);
  const retryCart = () => setRetryKey(value => value + 1);

  const additionalFields = CART_FIELDS;

  const resetCart = async () => {
    const generation = ++cartGeneration.current;
    // Wipe private in-memory state BEFORE the first asynchronous disk operation.
    setCart(undefined);
    setCartLoading(false);
    setCartError(undefined);
    setResetting(true);
    setResetFailed(true);
    try {
      await queueCartStorageWrite(async () => {
        // Make a restart-visible fail-closed marker before deleting the cart ID.
        // Even if the marker cannot be written, attempt the physical delete.
        let markerWritten = false;
        try {
          await AsyncStorage.setItem(CART_RESET_PENDING_KEY, '1');
          markerWritten = true;
        } catch {
          // On a fully failed storage device cross-restart durability is unknown.
          // Same-mount memory remains cleared, and removal is still attempted.
        }
        await AsyncStorage.removeItem(CART_KEY);
        if (markerWritten) await AsyncStorage.removeItem(CART_RESET_PENDING_KEY);
      });
      if (generation === cartGeneration.current) setResetFailed(false);
    } finally {
      if (generation === cartGeneration.current) setResetting(false);
    }
  };

  const updateCart = useCallback(
    async (data: CartUpdateData) => {
      if (!cart?.id) throw new Error('No cart found');
      const sourceCartId = cart.id;
      const generation = cartGeneration.current;
      const { cart: updatedCart } = await apiClient.store.cart.update(
        sourceCartId, data, { fields: additionalFields },
      );
      commitIfCurrent(updatedCart, sourceCartId, generation);
      return updatedCart;
    },
    [cart?.id, additionalFields, commitIfCurrent],
  );

  // Checkout awaits multiple SDK calls. Only accept their result if the
  // request still belongs to this cart and this pre-logout generation.
  const runCurrentCartTask = async (
    task: (activeCart: HttpTypes.StoreCart) => Promise<HttpTypes.StoreCart>,
  ): Promise<HttpTypes.StoreCart> => {
    const activeCart = cart;
    if (!activeCart?.id) throw new Error('No active cart for checkout');
    const generation = cartGeneration.current;
    const updatedCart = await task(activeCart);
    if (generation !== cartGeneration.current ||
        currentCartRef.current?.id !== activeCart.id ||
        updatedCart.id !== activeCart.id) {
      throw new Error('Cart changed during checkout; refresh the cart');
    }
    commitIfCurrent(updatedCart, activeCart.id, generation);
    return updatedCart;
  };

  // Restore can outlive a region switch or logout. Both React state and
  // persisted writes must belong to the same cart generation.
  useEffect(() => {
    if (!region?.id || resetting || resetFailed ||
      (cart?.id && cart.region_id === region.id)) return;
    let active = true;
    const generation = cartGeneration.current;
    const scopedStorage = {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => queueCartStorageWrite(async () => {
        if (generation === cartGeneration.current) {
          await AsyncStorage.setItem(key, value);
        }
      }),
      removeItem: (key: string) => queueCartStorageWrite(async () => {
        if (generation === cartGeneration.current) {
          await AsyncStorage.removeItem(key);
        }
      }),
    };
    setCartLoading(true);
    setCartError(undefined);
    (async () => {
      try {
        const nextCart = await restoreOrCreateCart(
          region.id, scopedStorage, apiClient.store.cart,
        );
        if (active && generation === cartGeneration.current) setCart(nextCart);
      } catch (error) {
        if (active && generation === cartGeneration.current) {
          console.error('Cart restore unavailable:', error);
          setCartError(error instanceof Error ? error.message : 'Cart unavailable');
        }
      } finally {
        if (active && generation === cartGeneration.current) setCartLoading(false);
      }
    })();
    return () => { active = false; };
  }, [
    region?.id, cart?.id, cart?.region_id, retryKey,
    resetting, resetFailed, queueCartStorageWrite,
  ]);

  const fetchCart = async (cartId: string, generation: number) => {
    const { cart: restored } = await apiClient.store.cart.retrieve(cartId, {
      fields: additionalFields,
    });
    commitIfCurrent(restored, cartId, generation);
  };

  const addToCart = async (variantId: string, quantity: number) => {
    if (!cart?.id) {
      throw new Error('Cart is not available; retry recovery before adding products');
    }
    const sourceCartId = cart.id;
    const generation = cartGeneration.current;
    try {
      const { cart: updatedCart } = await apiClient.store.cart.createLineItem(
        sourceCartId, { variant_id: variantId, quantity },
      );
      commitIfCurrent(updatedCart, sourceCartId, generation);
    } catch (err) {
      console.error('Add to cart failed:', err);
      throw err;
    }
  };

  const updateLineItem = async (lineItemId: string, quantity: number) => {
    if (!cart?.id) {
      throw new Error('Cart is not available; retry recovery before editing items');
    }
    const sourceCartId = cart.id;
    const generation = cartGeneration.current;
    try {
      if (quantity === 0) {
        await apiClient.store.cart.deleteLineItem(sourceCartId, lineItemId);
        if (generation === cartGeneration.current) {
          await fetchCart(sourceCartId, generation);
        }
      } else {
        const { cart: updatedCart } = await apiClient.store.cart.updateLineItem(
          sourceCartId, lineItemId, { quantity },
        );
        commitIfCurrent(updatedCart, sourceCartId, generation);
      }
    } catch (err) {
      console.error('Update cart item failed:', err);
      if (generation === cartGeneration.current && isMissingCartError(err)) {
        // Do not allow a stale A failure to clear B's replacement cart.
        await resetCart();
      }
      throw err;
    }
  };

  const linkCartToCustomer = async () => {
    const generation = cartGeneration.current;
    const sourceCartId = cart?.id;
    if (!sourceCartId) throw new Error('Cart is not available for customer transfer');
    const { cart: updatedCart } = await apiClient.store.cart.transferCart(sourceCartId);
    commitIfCurrent(updatedCart, sourceCartId, generation);
  };

  const setShippingMethod = async (shippingMethodId: string) => {
    const generation = cartGeneration.current;
    const sourceCartId = cart?.id;
    if (!sourceCartId) throw new Error('Cart is not available for shipping');
    const { cart: updatedCart } = await apiClient.store.cart.addShippingMethod(
      sourceCartId, { option_id: shippingMethodId },
      { fields: additionalFields },
    );
    commitIfCurrent(updatedCart, sourceCartId, generation);
    return updatedCart;
  };

  const applyPromoCode = async (code: string): Promise<boolean> => {
    if (!cart?.id) throw new Error('No cart found');
    const sourceCartId = cart.id;
    const generation = cartGeneration.current;
    try {
      const existingCodes =
        cart.promotions?.filter(p => !p.is_automatic && p.code)
          .map(p => p.code!) || [];
      const { cart: updatedCart } = await apiClient.store.cart.update(sourceCartId, {
        promo_codes: [...existingCodes, code],
      });
      if (generation !== cartGeneration.current) return false;
      commitIfCurrent(updatedCart, sourceCartId, generation);
      const updatedPromoCodes = updatedCart.promotions
        ?.filter(p => p.code).map(p => p.code);
      return updatedPromoCodes?.includes(code) ?? false;
    } catch {
      return false;
    }
  };

  const removePromoCode = async (code: string) => {
    if (!cart?.id) throw new Error('No cart found');
    const sourceCartId = cart.id;
    const generation = cartGeneration.current;
    const existingCodes =
      cart.promotions?.filter(p => !p.is_automatic && p.code !== code)
        .map(p => p.code!) || [];
    const { cart: updatedCart } = await apiClient.store.cart.update(sourceCartId, {
      promo_codes: existingCodes,
    });
    commitIfCurrent(updatedCart, sourceCartId, generation);
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
        runCurrentCartTask,
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
