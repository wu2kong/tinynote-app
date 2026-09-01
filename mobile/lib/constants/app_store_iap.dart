const appStoreMonthlyProductId = 'com.wu2kong.tinynote.app.pro.monthly';
const appStoreYearlyProductId = 'com.wu2kong.tinynote.app.pro.yearly';
const appStoreLifetimeProductId = 'com.wu2kong.tinynote.app.pro.lifetime';

const appStoreSubscriptionProductIds = [
  appStoreMonthlyProductId,
  appStoreYearlyProductId,
];

const appStoreProductIds = [
  ...appStoreSubscriptionProductIds,
  appStoreLifetimeProductId,
];

const appStoreFallbackPrices = {
  appStoreMonthlyProductId: '¥6 / 月',
  appStoreYearlyProductId: '¥68 / 年',
  appStoreLifetimeProductId: '¥128',
};

class AppStoreProduct {
  const AppStoreProduct({
    required this.productId,
    required this.title,
    required this.description,
    this.formattedPrice,
  });

  final String productId;
  final String title;
  final String description;
  final String? formattedPrice;

  factory AppStoreProduct.fromMap(Map<dynamic, dynamic> map) {
    return AppStoreProduct(
      productId: map['productId'] as String? ?? '',
      title: map['title'] as String? ?? '',
      description: map['description'] as String? ?? '',
      formattedPrice: map['formattedPrice'] as String?,
    );
  }
}

bool isAppStoreProductId(String productId) =>
    appStoreProductIds.contains(productId);
