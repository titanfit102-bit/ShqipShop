import React from 'react';
import { View } from 'react-native';
import Text from '@components/common/text';
import { useIndicativeFx } from '@data/indicative-fx';
import {
  formatShopPrice,
  getIndicativeConversion,
} from '@utils/dual-currency';

type ShopPriceProps = {
  amount: number;
  currencyCode: string;
  primaryClassName?: string;
  testID?: string;
};

/** Primary amount belongs to the real Medusa currency; grey line is only a hint. */
const ShopPrice = ({
  amount,
  currencyCode,
  primaryClassName = 'text-base text-content',
  testID,
}: ShopPriceProps) => {
  const { data } = useIndicativeFx();
  const secondary = getIndicativeConversion(amount, currencyCode, data);

  return (
    <View className="flex flex-col">
      <Text className={primaryClassName} testID={testID}>
        {formatShopPrice(amount, currencyCode)}
      </Text>
      {secondary && (
        <Text className="text-xs text-gray-500" testID={testID ? `${testID}-indicative` : undefined}>
          {secondary}
        </Text>
      )}
    </View>
  );
};

export default ShopPrice;
