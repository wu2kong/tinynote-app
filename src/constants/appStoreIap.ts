export const APP_STORE_SUBSCRIPTION_PRODUCT_IDS = [
  'com.wu2kong.tinynote.app.pro.monthly',
  'com.wu2kong.tinynote.app.pro.yearly',
] as const;

export const APP_STORE_LIFETIME_PRODUCT_ID = 'com.wu2kong.tinynote.app.pro.lifetime';

export const APP_STORE_PRODUCT_IDS = [
  ...APP_STORE_SUBSCRIPTION_PRODUCT_IDS,
  APP_STORE_LIFETIME_PRODUCT_ID,
] as const;

export type AppStoreProductId = (typeof APP_STORE_PRODUCT_IDS)[number];

export type AppStoreProduct = {
  productId: AppStoreProductId;
  title: string;
  description: string;
  formattedPrice?: string;
};
