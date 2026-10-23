import React, { useRef } from 'react';
import { View, ScrollView, Image } from 'react-native';
import { useLocalization } from '@fluent/react';
import Text from '@components/common/text';
import Navbar from '@components/common/navbar';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@api/client';
import type { HttpTypes } from '@medusajs/types';
import { formatImageUrl } from '@utils/image-url';
import { formatShopPrice } from '@utils/dual-currency';
import ShopPrice from '@components/common/shop-price';
import { getOrderProductsSubtotal } from '@utils/order-totals';
import dayjs from 'dayjs';
import Loader from '@components/common/loader';
import ErrorUI from '@components/common/error-ui';
import { getFulfillmentStatus, type FulfillmentStatus } from '@utils/order';
import { useCountries } from '@data/region-context';
import utils from '@utils/common';
import Button from '@components/common/button';
import { useNavigation } from '@react-navigation/native';
import { useCustomer } from '@data/customer-context';
import { privateCustomerQueryKey } from '@data/private-customer-queries';

type OrderDetailProps = {
  route: {
    params: {
      orderId: string;
      cartProof?: string;
    };
  };
};

const OrderDetail = ({ route }: OrderDetailProps) => {
  const { l10n } = useLocalization();
  const { orderId, cartProof } = route.params;
  const { customer } = useCustomer();
  // An order page opened under A must never be reused under B or signed-out.
  // Guest receipts opened as guest retain their own route identity.
  const openedFor = useRef(customer?.id ?? 'guest');
  const samePrincipal = openedFor.current === (customer?.id ?? 'guest');
  const navigation = useNavigation();

  const {
    data: order,
    isPending,
    error,
  } = useQuery({
    queryKey: privateCustomerQueryKey(customer?.id, 'order-detail', orderId),
    enabled: samePrincipal && (!!customer || !!cartProof),
    queryFn: async () => {
      if (customer) {
        const { order: accountOrder } = await apiClient.store.order.retrieve(orderId);
        return accountOrder;
      }
      if (!cartProof) throw new Error('Guest receipt requires originating cart proof');
      // Header-only capability: do not include secret in URL, logs or query keys.
      const { order: guestOrder } = await apiClient.client.fetch<HttpTypes.StoreOrderResponse>(
        `/store/orders/${encodeURIComponent(orderId)}`,
        { headers: { 'x-shqipshop-cart-proof': cartProof } },
      );
      return guestOrder;
    },
  });

  const countries = useCountries();

  if (!samePrincipal) {
    // Do not refetch an old receipt through Medusa's guest-accessible order API.
    return <ErrorUI />;
  }

  if (!customer && !cartProof) return <ErrorUI />;

  if (isPending) {
    return <Loader />;
  }

  if (error) {
    return <ErrorUI />;
  }

  if (!order) {
    return (
      <View className="flex-1 bg-background p-safe">
        <Navbar title={l10n.getString('order-details')} />
        <Text className="text-center text-gray-500 mt-6">
          {l10n.getString('order-not-found')}
        </Text>
      </View>
    );
  }

  const itemsSubtotal = getOrderProductsSubtotal(order);
  const shippingMethodName =
    order.shipping_methods?.[0]?.name || l10n.getString('shipping-method');

  return (
    <View className="flex-1 bg-background p-safe">
      <Navbar title={l10n.getString('order-details')} />
      <ScrollView className="flex-1">
        <View className="p-4">
          {/* Order Header */}
          <View className="mb-6">
            <Text className="text-xl font-bold mb-1">
              {l10n.getString('order-with-id', { id: order.display_id || '-' })}
            </Text>
            <Text className="text-content opacity-60">
              {l10n.getString('placed-on', {
                datetime: dayjs(order.created_at).format('MMMM D, YYYY h:mm A'),
              })}
            </Text>
          </View>

          {/* Order Status */}
          <View className="mb-6">
            <Text className="font-semibold mb-2 opacity-60">
              {l10n.getString('status')}
            </Text>
            <Text className="text-content">
              {l10n.getString(
                getFulfillmentStatus(
                  order.fulfillment_status as FulfillmentStatus,
                ),
              )}
            </Text>
          </View>

          {/* Order Items */}
          <View className="mb-6">
            <Text className="font-semibold">
              {l10n.getString('order-items')}
            </Text>
            {order.items?.map(item => (
              <View
                key={item.id}
                className="flex-row items-start py-4 border-b border-primary"
              >
                <Image
                  source={{
                    uri: item.thumbnail
                      ? formatImageUrl(item.thumbnail)
                      : 'https://placeholder.com/48',
                  }}
                  className="w-12 h-12 rounded"
                  resizeMode="cover"
                />
                <View className="flex-1 ml-3">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-medium">{item.product_title}</Text>
                      {item.variant?.title && (
                        <Text className="text-sm text-gray-500">
                          Variant: {item.variant.title}
                        </Text>
                      )}
                    </View>
                    <View className="items-end">
                      <Text className="text-sm">
                        {item.quantity}x{' '}
                        {formatShopPrice(item.unit_price, order.currency_code)}
                      </Text>
                      <Text className="text-sm font-medium">
                        {formatShopPrice(item.unit_price * item.quantity, order.currency_code)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Shipping Address */}
          {order.shipping_address && (
            <View className="flex-row justify-between mb-6">
              <View className="gap-1">
                <Text className="opacity-60 mb-1">
                  {l10n.getString('shipping-address')}
                </Text>
                <Text>
                  {order.shipping_address.first_name}{' '}
                  {order.shipping_address.last_name}
                </Text>
                <Text>{order.shipping_address.address_1}</Text>
                {order.shipping_address.address_2 && (
                  <Text>{order.shipping_address.address_2}</Text>
                )}
                <Text>
                  {order.shipping_address.city},{' '}
                  {order.shipping_address.province}{' '}
                  {order.shipping_address.postal_code}
                </Text>
                <Text>
                  {utils.getCountryName(
                    order.shipping_address.country_code,
                    countries,
                  )}
                </Text>
              </View>
              <View className="gap-1">
                <Text className="opacity-60 mb-1">
                  {l10n.getString('contact')}
                </Text>
                <Text>{order.email}</Text>
                {order.shipping_address?.phone && (
                  <Text>{order.shipping_address.phone}</Text>
                )}
              </View>
            </View>
          )}

          <View className="mb-6">
            <View>
              <Text className="opacity-60 mb-1">
                {l10n.getString('method')}
              </Text>
              <Text>
                {shippingMethodName} ({formatShopPrice(order.shipping_total, order.currency_code)})
              </Text>
            </View>
          </View>

          {/* Order Summary */}
          <View className="mb-6">
            <Text className="text-lg mb-2">
              {l10n.getString('order-summary')}
            </Text>
            <View className="flex-row justify-between mb-2">
              <Text className="opacity-60">{l10n.getString('subtotal')}</Text>
              <Text>
                {itemsSubtotal === null ? '—' : formatShopPrice(itemsSubtotal, order.currency_code)}
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="opacity-60">{l10n.getString('shipping')}</Text>
              <Text>
                {formatShopPrice(order.shipping_total, order.currency_code)}
              </Text>
            </View>
            {order.discount_total > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="opacity-60">{l10n.getString('discount')}</Text>
                <Text className="text-green-600">
                  -
                  {formatShopPrice(order.discount_total, order.currency_code)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between mb-2">
              <Text className="opacity-60">{l10n.getString('taxes')}</Text>
              <Text>
                {order.tax_total
                  ? formatShopPrice(order.tax_total, order.currency_code)
                  : '-'}
              </Text>
            </View>
            <View className="flex-row justify-between mt-2 pt-2 border-t border-primary">
              <Text className="font-content-bold text-lg">
                {l10n.getString('total')}
              </Text>
              <ShopPrice
                amount={order.total}
                currencyCode={order.currency_code}
                primaryClassName="font-content-bold text-lg"
                testID="order-payable-total"
              />
            </View>
          </View>
        </View>
      </ScrollView>
      <View className="p-4 bg-background-secondary">
        <Button
          title={l10n.getString('continue-shopping')}
          onPress={() => {
            navigation.navigate('Main');
          }}
        />
      </View>
    </View>
  );
};

export default OrderDetail;
