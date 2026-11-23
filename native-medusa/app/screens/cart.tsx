import React, { useRef, useState } from 'react';
import Navbar from '@components/common/navbar';
import Text from '@components/common/text';
import { useCart } from '@data/cart-context';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import Button from '@components/common/button';
import { useNavigation } from '@react-navigation/native';
import { useLocalization } from '@fluent/react';
import CartContent from '@components/cart/cart-content';
import { useCustomer } from '@data/customer-context';
import { nativeCheckoutRecoveryScope } from '@data/native-checkout-recovery';
import { getNativeAuthVersion, isCurrentAuthAttempt } from '@api/auth-token-storage';
import { ORDER_COMPLETION_PENDING_MESSAGE } from '@data/order-completion-recovery';

const Cart = () => {
  const { l10n } = useLocalization();
  const { cart, cartLoading, cartError, retryCart, recoverPendingOrder } = useCart();
  const { customer } = useCustomer();
  const recoveryScope = nativeCheckoutRecoveryScope(customer?.id);
  const currentOwner = useRef(customer?.id);
  currentOwner.current = customer?.id;
  const recoveryRunning = useRef(false);
  const [checkingOrder, setCheckingOrder] = useState(false);
  const [cancelledOrder, setCancelledOrder] = useState<number>();
  const isEmptyCart = !cart?.items || cart.items.length === 0;
  const unknownOrder = cartError === ORDER_COMPLETION_PENDING_MESSAGE;

  const navigation = useNavigation();

  const checkOrder = async () => {
    if (!recoveryScope || recoveryRunning.current) return;
    const version = getNativeAuthVersion();
    const isCurrent = () => isCurrentAuthAttempt(version) &&
      currentOwner.current === recoveryScope.customerId && navigation.isFocused();

    recoveryRunning.current = true;
    setCheckingOrder(true);
    try {
      const result = await recoverPendingOrder(recoveryScope, isCurrent);
      if (!isCurrent()) return;
      if (result.state === 'confirmed') {
        navigation.navigate('OrderDetail', { orderId: result.orderId });
      } else if (result.state === 'no_order') {
        setCancelledOrder(version);
      }
    } finally {
      recoveryRunning.current = false;
      setCheckingOrder(false);
    }
  };

  const goToCheckout = () => {
    navigation.navigate('Checkout');
  };

  const goHome = () => {
    navigation.navigate('Main');
  };
  return (
    <View className="flex-1 bg-background p-safe">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <Navbar title={l10n.getString('cart')} />
        <View className="p-4">
          {cancelledOrder !== undefined && isCurrentAuthAttempt(cancelledOrder) && (
            <Text className="mb-4 text-center">{l10n.getString('order-not-created')}</Text>
          )}
          {cartLoading && !cart ? (
            <ActivityIndicator accessibilityLabel="Loading cart" />
          ) : cartError && (!cart || unknownOrder) ? (
            <View className="gap-4">
              <Text className="text-center">
                {l10n.getString(
                  unknownOrder ? 'order-confirmation-pending' : 'an-error-occurred',
                )}
              </Text>
              {unknownOrder && recoveryScope && (
                <Button
                  title={l10n.getString('check-order-status')}
                  onPress={checkOrder}
                  disabled={checkingOrder}
                />
              )}
              {!unknownOrder && (
                <Button title={l10n.getString('continue')} onPress={retryCart} />
              )}
            </View>
          ) : !isEmptyCart ? (
            <CartContent cart={cart} mode="cart" />
          ) : (
            <EmptyCart />
          )}
        </View>
      </ScrollView>
      <View className="p-4 bg-background-secondary">
        {!isEmptyCart && !cartError ? (
          <Button title={l10n.getString('checkout')} onPress={goToCheckout} />
        ) : (
          <Button title={l10n.getString('go-home')} onPress={goHome} disabled={cartLoading || checkingOrder} />
        )}
      </View>
    </View>
  );
};

const EmptyCart = () => {
  const { l10n } = useLocalization();
  return (
    <View className="px-4 mt-20">
      <Text className="text-lg text-center">
        {l10n.getString('you-dont-have-anything-in-your-cart')}
      </Text>
    </View>
  );
};

export default Cart;
