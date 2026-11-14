import React from 'react';
import { useColors } from '@styles/hooks';
import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';
import Icon from '@react-native-vector-icons/ant-design';
import { useLocalization } from '@fluent/react';
import Text from '@components/common/text';
import { useCart } from '@data/cart-context';

type LineItemQuantityProps = {
  quantity: number;
  lineItemId: string;
  mode: 'checkout' | 'cart';
};

const LineItemQuantity = ({
  quantity,
  lineItemId,
  mode,
}: LineItemQuantityProps) => {
  const { l10n } = useLocalization();
  const colors = useColors();
  const { updateLineItem } = useCart();
  const [updating, setUpdating] = React.useState(false);

  const increment = async () => {
    const newQuantity = quantity + 1;
    return updateQuantity(newQuantity);
  };

  const decrement = async () => {
    const newQuantity = quantity - 1;
    return updateQuantity(newQuantity);
  };

  const changeQuantity = async (newQuantity: number) => {
    if (updating) return;
    setUpdating(true);
    try {
      await updateLineItem(lineItemId, newQuantity);
    } catch (error) {
      Alert.alert(
        l10n.getString('error'),
        error instanceof Error ? error.message : l10n.getString('an-error-occurred'),
      );
    } finally {
      setUpdating(false);
    }
  };

  const deleteLineItem = () => changeQuantity(0);
  const updateQuantity = (newQuantity: number) => changeQuantity(newQuantity);

  return (
    <View className="flex-row items-center gap-4">
      {mode === 'cart' ? (
        <View className="flex flex-row gap-2 bg-background border-hairline border-primary rounded-lg self-start p-1 items-center">
          <TouchableOpacity
            onPress={decrement}
            disabled={updating}
            className="justify-center items-center px-1 py-1"
          >
            <Icon name="minus" size={12} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-base">{quantity}</Text>
          <TouchableOpacity
            onPress={increment}
            disabled={updating}
            className="justify-center items-center px-1 py-1"
          >
            <Icon name="plus" size={12} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <Text className="text-base">
          {l10n.getString('qty')}: {quantity}
        </Text>
      )}
      {updating ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : mode === 'cart' ? (
        <TouchableOpacity onPress={deleteLineItem} disabled={updating} className="opacity-75">
          <Icon name="delete" size={16} color={colors.content} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default LineItemQuantity;
