import React, { useEffect, useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { useLocalization } from '@fluent/react';
import { useCart } from '@data/cart-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import Text from '@components/common/text';
import Button from '@components/common/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Navbar from '@components/common/navbar';
import apiClient from '@api/client';
import { authTokenStorage, AUTH_TOKEN_KEY, getNativeAuthVersion, isCurrentAuthAttempt } from '@api/auth-token-storage';
import { nativeCheckoutRecoveryEnabled, nativeCheckoutRecoveryScope, nativeQuoteReviewEnabled } from '@data/native-checkout-recovery';
import { readCheckoutQuote, type CheckoutQuote } from '@data/checkout-quote';
import type { CheckoutRecoveryScope } from '@data/order-completion-recovery';
import {
  CheckoutFormData,
  checkoutSchema,
  AddressFields,
  CHECKOUT_STEPS,
  PAYMENT_PROVIDER_DETAILS_MAP,
  createEmptyAddress,
  CheckoutStep,
  addressSchema,
} from '../types/checkout';
import CheckoutSteps from '@components/checkout/checkout-steps';
import AddressStep from '@components/checkout/steps/address-step';
import ShippingStep from '@components/checkout/steps/shipping-step';
import PaymentStep from '@components/checkout/steps/payment-step';
import ReviewStep from '@components/checkout/steps/review-step';
import {
  useCountries,
  useCurrentCheckoutStep,
  useActivePaymentSession,
} from '@data/hooks';
import { StoreCartAddress } from '@medusajs/types';
import utils from '@utils/common';
import { activeCheckoutPaymentSession } from '@data/checkout-progress';
import { CART_FIELDS } from '@data/cart-recovery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  reserveOrderCompletion,
  clearKnownOrderCompletion,
  ORDER_COMPLETION_PENDING_MESSAGE,
} from '@data/order-completion-recovery';

const quoteEndpoint = '/store/shqipshop/quote-review-accept-ci';
const responseStatus = (error: unknown) =>
  (error as {status?: number} | null)?.status;

const Checkout = () => {
  const { l10n } = useLocalization();
  const {
    cart, runCurrentCartTask, runCurrentCartCompletion, updateCart, retryCart,
  } = useCart();
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingShipping, setIsUpdatingShipping] = useState(false);
  const countries = useCountries();
  const currentStep = useCurrentCheckoutStep();
  const activeSession = useActivePaymentSession();
  const [selectedPaymentProviderId, setSelectedPaymentProviderId] = useState(
    activeSession?.provider_id,
  );

  const [activeStep, setActiveStep] = useState(currentStep);
  const [reviewed, setReviewed] = useState<{
    cartId: string; authVersion: number; quote: CheckoutQuote; changed: boolean;
  }>();
  const review = reviewed?.cartId === cart?.id && reviewed &&
    isCurrentAuthAttempt(reviewed.authVersion) ? reviewed : undefined;

  const requestQuoteReview = async (changed = false) => {
    const authVersion = getNativeAuthVersion();
    const cartId = cart?.id;
    if (!cartId) return;
    const priced = readCheckoutQuote(await apiClient.client.fetch(quoteEndpoint, {
      method: 'POST',
      headers: {'x-shqipshop-cart-id': cartId},
      body: {review: true},
    }));
    if (isCurrentAuthAttempt(authVersion)) {
      setReviewed({cartId, authVersion, quote: priced,
        changed: changed || String(cart?.total) !== priced.total});
    }
  };

  // An expired/changed cart cannot keep the old Review screen active.
  useEffect(() => {
    const allowed = CHECKOUT_STEPS.findIndex(step => step.id === currentStep);
    setActiveStep(previous => {
      const selected = CHECKOUT_STEPS.findIndex(step => step.id === previous);
      return selected > allowed ? currentStep : previous;
    });
  }, [currentStep]);

  const getAddressFromCart = (
    cartAddress?: StoreCartAddress,
  ): AddressFields => {
    if (!cartAddress) {
      return createEmptyAddress();
    }
    const result = addressSchema.safeParse(cartAddress);
    return result.success ? result.data : createEmptyAddress();
  };

  const defaultValues: CheckoutFormData = {
    email: cart?.email || '',
    shipping_address: getAddressFromCart(cart?.shipping_address),
    billing_address: getAddressFromCart(cart?.billing_address),
    use_same_billing:
      cart?.billing_address && cart?.shipping_address
        ? utils.areEqualObjects(
            addressSchema.safeParse(cart.billing_address),
            addressSchema.safeParse(cart.shipping_address),
          )
        : true,
  };

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues,
  });

  // Check if cart is empty
  const isEmptyCart = !cart?.items || cart.items.length === 0;

  if (isEmptyCart) {
    return null;
  }

  const renderStep = () => {
    switch (activeStep) {
      case 'address':
        return (
          <AddressStep
            form={form}
            isLoading={isLoading}
            countries={countries}
          />
        );
      case 'delivery':
        return (
          <ShippingStep cart={cart} onUpdatingChange={setIsUpdatingShipping} />
        );
      case 'payment':
        return (
          <PaymentStep
            cart={cart}
            selectedProviderId={selectedPaymentProviderId}
            onSelectProvider={setSelectedPaymentProviderId}
          />
        );
      case 'review':
        return (
          <ReviewStep
            cart={cart}
            selectedProviderId={selectedPaymentProviderId}
          />
        );
      default:
        return null;
    }
  };

  const handleStepPress = (step: CheckoutStep) => {
    const currentStepIndex = CHECKOUT_STEPS.findIndex(s => s.id === activeStep);
    const targetStepIndex = CHECKOUT_STEPS.findIndex(s => s.id === step);

    if (targetStepIndex < currentStepIndex) {
      setReviewed(undefined);
      setActiveStep(step);
    }
  };

  const handleAddressSubmit = async () => {
    const useSameBilling = form.getValues('use_same_billing');
    const validateFields: (keyof CheckoutFormData)[] = [
      'email',
      'shipping_address',
    ];
    if (!useSameBilling) {
      validateFields.push('billing_address');
    }
    const isValid = await form.trigger(validateFields);
    if (!isValid) {
      return;
    }

    const { email, shipping_address, billing_address, use_same_billing } =
      form.getValues();

    const payload = {
      email,
      shipping_address,
      billing_address: use_same_billing ? shipping_address : billing_address,
    };

    await updateCart(payload);

    setActiveStep('delivery');
  };

  const handleDeliverySubmit = () => {
    if (
      isUpdatingShipping ||
      !cart.shipping_methods?.some(method => method.shipping_option_id)
    ) {
      throw new Error(l10n.getString('select-shipping-method'));
    }
    setActiveStep('payment');
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPaymentProviderId) {
      throw new Error(l10n.getString('please-select-a-payment-method'));
    }
    if (!cart) {
      throw new Error(l10n.getString('no-cart-found'));
    }

    // Scope both async SDK requests to the original cart generation; a late
    // response after logout/reset cannot restore private cart data or review.
    await runCurrentCartTask(async activeCart => {
      await apiClient.store.payment.initiatePaymentSession(activeCart, {
        provider_id: selectedPaymentProviderId,
      });
      // Local payment selection is not evidence of a confirmed session.
      const { cart: refreshed } = await apiClient.store.cart.retrieve(activeCart.id, {
        fields: CART_FIELDS,
      });
      const session = activeCheckoutPaymentSession(refreshed);
      if (!session || session.provider_id !== selectedPaymentProviderId) {
        setActiveStep('payment');
        throw new Error('The payment session was not confirmed; retry payment');
      }
      return refreshed;
    });
    setActiveStep('review');
  };

  const handleOrderComplete = async (quote?: CheckoutQuote) => {
    if (!cart?.id) {
      throw new Error(l10n.getString('no-cart-found'));
    }
    const session = activeCheckoutPaymentSession(cart);
    if (!session || session.provider_id !== selectedPaymentProviderId) {
      setActiveStep('payment');
      throw new Error('Payment session is missing or outdated; select a payment method again');
    }

    const selectedProvider = selectedPaymentProviderId
      ? PAYMENT_PROVIDER_DETAILS_MAP[selectedPaymentProviderId]
      : null;

    if (selectedProvider?.hasExternalStep) {
      switch (selectedPaymentProviderId) {
        case 'pp_stripe_stripe':
          // TODO: Implement Stripe payment flow
          break;
        default:
          throw new Error(l10n.getString('payment-provider-not-supported'));
      }
    } else {
      let recoveryScope: CheckoutRecoveryScope | undefined;
      const authVersion = getNativeAuthVersion();
      const { cartId, orderId, isCurrent } = await runCurrentCartCompletion(async activeCart => {
        const activePayment = activeCheckoutPaymentSession(activeCart);
        if (!activePayment || activePayment.provider_id !== selectedPaymentProviderId) {
          throw new Error('Payment session is missing or outdated');
        }
        // Persist BEFORE the irreversible server call; never replay an
        // uncertain outcome (even if the cart later returns 404).
        if (nativeCheckoutRecoveryEnabled && await authTokenStorage.getItem(AUTH_TOKEN_KEY)) {
          const { customer } = await apiClient.store.customer.retrieve();
          recoveryScope = nativeCheckoutRecoveryScope(customer.id);
          if (!recoveryScope || activeCart.customer_id !== customer.id ||
              !isCurrentAuthAttempt(authVersion)) {
            throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
          }
        }
        if (nativeCheckoutRecoveryEnabled && !isCurrentAuthAttempt(authVersion)) {
          throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
        }
        if (quote) {
          if (!recoveryScope || activeCart.id !== review?.cartId ||
              !isCurrentAuthAttempt(review.authVersion)) {
            throw new Error(l10n.getString('review-current-quote'));
          }
          const accepted = await apiClient.client.fetch<{accepted: boolean; quote_id: string}>(
            quoteEndpoint, {
              method: 'POST',
              headers: {'x-shqipshop-cart-id': activeCart.id},
              body: {quote_id: quote.id, fingerprint: quote.fingerprint},
            },
          );
          if (accepted.accepted !== true || accepted.quote_id !== quote.id ||
              !isCurrentAuthAttempt(authVersion)) {
            throw new Error(l10n.getString('review-current-quote'));
          }
        }
        await reserveOrderCompletion(activeCart.id, AsyncStorage, recoveryScope);
        if (nativeCheckoutRecoveryEnabled && !isCurrentAuthAttempt(authVersion)) {
          throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
        }
        let response: Awaited<ReturnType<typeof apiClient.store.cart.complete>>;
        try {
          response = quote ? await apiClient.store.cart.complete(activeCart.id, {}, {
            'x-shqipshop-quote-id': quote.id,
            'x-shqipshop-quote-fingerprint': quote.fingerprint,
          }) : await apiClient.store.cart.complete(activeCart.id);
        } catch (error) {
          // 412 is the quote precondition refusal before the N03 dispatch claim.
          if (quote && recoveryScope && responseStatus(error) === 412 &&
              error instanceof Error && error.message === 'F07G_QUOTE_REVIEW_REQUIRED') {
            await clearKnownOrderCompletion(activeCart.id, AsyncStorage, recoveryScope,
              () => isCurrentAuthAttempt(authVersion));
            throw error;
          }
          throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
        }
        if (response.type === 'cart') {
          // Tracked checkout can hold a server dispatch claim without a receipt.
          if (recoveryScope) throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
          await clearKnownOrderCompletion(activeCart.id, AsyncStorage);
          throw new Error(
            response.error?.message || l10n.getString('failed-to-complete-order'),
          );
        }
        if (!response.order?.id) throw new Error(ORDER_COMPLETION_PENDING_MESSAGE);
        return response.order.id;
      });
      // resetCart is complete; do not clear marker if disk cleanup failed.
      await clearKnownOrderCompletion(cartId, AsyncStorage, recoveryScope,
        () => !recoveryScope || (isCurrent() && isCurrentAuthAttempt(authVersion)));
      // Logout can begin while journal removal awaits; fence the final handoff.
      // Navigation follows synchronously, with no additional await.
      if (!isCurrent() || (recoveryScope && !isCurrentAuthAttempt(authVersion))) {
        throw new Error('Cart changed while completing order; do not submit again');
      }
      retryCart();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            { name: 'Main' },
            { name: 'OrderDetail', params: { orderId, cartProof: cartId } },
          ],
        }),
      );
    }
  };

  const handleContinue = async () => {
    setIsLoading(true);
    if (activeStep !== 'review') setReviewed(undefined);
    try {
      switch (activeStep) {
        case 'address':
          await handleAddressSubmit();
          break;
        case 'delivery':
          handleDeliverySubmit();
          break;
        case 'payment':
          await handlePaymentSubmit();
          break;
        case 'review':
          if (!nativeQuoteReviewEnabled) {
            await handleOrderComplete();
          } else if (!review) {
            await requestQuoteReview();
          } else {
            try {
              await handleOrderComplete(review.quote);
            } catch (error) {
              if (![409, 412].includes(responseStatus(error) ?? 0)) throw error;
              setReviewed(undefined);
              await requestQuoteReview(true);
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert(
        l10n.getString('error'),
        error instanceof Error && error.message === ORDER_COMPLETION_PENDING_MESSAGE
          ? l10n.getString('order-confirmation-pending')
          : error instanceof Error
            ? error.message
            : l10n.getString('an-error-occurred'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getReviewStepCtaText = () => {
    const selectedProvider =
      PAYMENT_PROVIDER_DETAILS_MAP[selectedPaymentProviderId ?? ''];

    if (selectedProvider?.hasExternalStep) {
      return l10n.getString('pay-using-provider', {
        provider: selectedProvider.name,
      });
    }
    return l10n.getString('place-order');
  };

  const getCtaText = () => {
    switch (activeStep) {
      case 'address':
        return l10n.getString('continue-to-delivery');
      case 'delivery':
        return l10n.getString('continue-to-payment');
      case 'payment':
        return l10n.getString('review-order');
      case 'review':
        if (nativeQuoteReviewEnabled) {
          return l10n.getString(review ? 'accept-quote-and-order' : 'review-current-quote');
        }
        return getReviewStepCtaText();
      default:
        return l10n.getString('continue');
    }
  };

  return (
    <View className="flex-1 bg-background p-safe">
      <View className="flex-1">
        <View className="mb-4">
          <Navbar title={l10n.getString('checkout')} />
        </View>
        <CheckoutSteps currentStep={activeStep} onStepPress={handleStepPress} />
        <ScrollView className="flex-1 px-4" contentContainerClassName="pb-4">
          {nativeQuoteReviewEnabled && activeStep === 'review' && review && (
            <View className="gap-1 py-4">
              {review.changed && <Text>{l10n.getString('checkout-quote-changed')}</Text>}
              <Text>{l10n.getString('checkout-quote-total', {amount: review.quote.total})}</Text>
            </View>
          )}
          {renderStep()}
        </ScrollView>
      </View>
      <View className="p-4 bg-background-secondary border-t border-gray-200">
        <Button
          variant="primary"
          title={getCtaText()}
          onPress={handleContinue}
          loading={isLoading}
          disabled={
            isLoading || (activeStep === 'delivery' &&
            (isUpdatingShipping ||
              !cart.shipping_methods?.some(method => method.shipping_option_id)))
          }
        />
      </View>
    </View>
  );
};

export default Checkout;
