import React from 'react';
import { View } from 'react-native';
import { getProductPrice } from '@utils/product-price';
import { HttpTypes } from '@medusajs/types';
import Text from '@components/common/text';
import ShopPrice from '@components/common/shop-price';
import { formatShopPrice } from '@utils/dual-currency';

export default function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct;
  variant?: HttpTypes.StoreProductVariant;
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  });

  const selectedPrice = variant ? variantPrice : cheapestPrice;

  if (!selectedPrice) {
    return <View className="w-32 h-7 bg-gray-100" />;
  }

  return (
    <View className="flex flex-col">
      <ShopPrice
        amount={selectedPrice.calculated_price_number}
        currencyCode={selectedPrice.currency_code}
        primaryClassName="font-content-bold text-lg"
        testID="product-shop-price"
      />

      {selectedPrice.price_type === 'sale' && (
        <>
          <Text className="text-gray-600">
            <Text>Original: </Text>
            <Text
              className="line-through"
              testID="original-product-price"
              accessibilityValue={{
                text: selectedPrice.original_price_number.toString(),
              }}
            >
              {formatShopPrice(selectedPrice.original_price_number, selectedPrice.currency_code)}
            </Text>
          </Text>
          <Text className="text-primary">
            -{selectedPrice.percentage_diff}%
          </Text>
        </>
      )}
    </View>
  );
}
