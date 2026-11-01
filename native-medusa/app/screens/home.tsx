import React from 'react';
import { ActivityIndicator, View, StatusBar, TouchableOpacity } from 'react-native';
import Icon from '@react-native-vector-icons/ant-design';
import { useTheme } from '@styles/hooks';
import Header from '@components/home/header';
import ProductsList from '@components/product/product-list';
import HeroCarousel from '@components/home/hero-carousel';
import FeaturedCollection from '@components/home/featured-collection';
import { themeNames } from '@styles/themes';
import { useRegion } from '@data/region-context';
import Button from '@components/common/button';
import Text from '@components/common/text';

const Home = () => {
  const { name, setThemeName } = useTheme();
  const switchTheme = () => {
    const nextTheme =
      themeNames[(themeNames.indexOf(name) + 1) % themeNames.length];
    setThemeName(nextTheme);
  };
  const { isDarkMode } = useTheme();
  const { region, regionLoading, regionError, retryRegion } = useRegion();

  if (!region) {
    return (
      <View className="flex-1 bg-background p-safe items-center justify-center px-6">
        {regionLoading ? (
          <ActivityIndicator accessibilityLabel="Loading store region" />
        ) : (
          <>
            <Text className="text-center mb-4">
              {regionError ? 'Unable to load your store region. Check your connection.' : 'No store region available.'}
            </Text>
            <Button title="Retry" onPress={retryRegion} />
          </>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background p-safe">
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Header />
      <View className="flex-1 mt-4">
        <ProductsList
          headerComponent={
            <>
              <HeroCarousel />
              <FeaturedCollection />
            </>
          }
        />
      </View>
      <View className="absolute bottom-4 right-4">
        <TouchableOpacity
          onPress={switchTheme}
          className="p-4 bg-primary rounded-full"
        >
          <Icon className="" name="switcher" size={24} color={'white'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Home;
