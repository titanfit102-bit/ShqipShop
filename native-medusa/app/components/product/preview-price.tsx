import React from 'react';
import Text from '@components/common/text';
import { VariantPrice } from 'types/global';
import ShopPrice from '@components/common/shop-price';
import { formatShopPrice } from '@utils/dual-currency';

export default function PreviewPrice({ price }: { price: VariantPrice }) {
  if (!price) {
    return null;
  }

  return (
    <>
      {price.price_type === 'sale' && (
        <Text className="line-through">{formatShopPrice(price.original_price_number, price.currency_code)}</Text>
      )}
      <ShopPrice amount={price.calculated_price_number} currencyCode={price.currency_code} testID="catalog-shop-price" />
    </>
  );
}
