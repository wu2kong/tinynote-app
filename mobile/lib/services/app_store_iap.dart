import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../constants/app_store_iap.dart';

const _channelName = 'com.wu2kong.tinynote/iap';

bool get isAppStoreIapAvailable => !kIsWeb && Platform.isIOS;

class AppStorePurchaseResult {
  const AppStorePurchaseResult({
    required this.purchased,
    required this.cancelled,
    required this.pending,
    required this.isPro,
  });

  final bool purchased;
  final bool cancelled;
  final bool pending;
  final bool isPro;
}

class AppStoreIapException implements Exception {
  const AppStoreIapException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => message;
}

abstract class AppStoreIapClient {
  Future<List<AppStoreProduct>> getProducts();
  Future<bool> getEntitlement();
  Future<AppStorePurchaseResult> purchase(String productId);
  Future<bool> restore();
}

class AppStoreIap implements AppStoreIapClient {
  AppStoreIap({MethodChannel? channel})
    : _channel = channel ?? const MethodChannel(_channelName);

  final MethodChannel _channel;

  @override
  Future<List<AppStoreProduct>> getProducts() async {
    if (!isAppStoreIapAvailable) return const [];
    try {
      final raw = await _channel.invokeMethod<List<dynamic>>('getProducts');
      return (raw ?? const [])
          .whereType<Map<dynamic, dynamic>>()
          .map(AppStoreProduct.fromMap)
          .where((product) => isAppStoreProductId(product.productId))
          .toList();
    } on MissingPluginException {
      return const [];
    } on PlatformException catch (error) {
      throw AppStoreIapException(
        error.code,
        error.message ?? error.code,
      );
    }
  }

  @override
  Future<bool> getEntitlement() async {
    if (!isAppStoreIapAvailable) return false;
    try {
      final raw = await _channel.invokeMethod<Map<dynamic, dynamic>>(
        'getEntitlement',
      );
      return raw?['isPro'] == true;
    } on MissingPluginException {
      return false;
    } on PlatformException catch (error) {
      throw AppStoreIapException(
        error.code,
        error.message ?? error.code,
      );
    }
  }

  @override
  Future<AppStorePurchaseResult> purchase(String productId) async {
    if (!isAppStoreIapAvailable) {
      throw const AppStoreIapException(
        'UNAVAILABLE',
        'App Store purchases are only available on iOS.',
      );
    }
    try {
      final raw = await _channel.invokeMethod<Map<dynamic, dynamic>>(
        'purchase',
        {'productId': productId},
      );
      return AppStorePurchaseResult(
        purchased: raw?['purchased'] == true,
        cancelled: raw?['cancelled'] == true,
        pending: raw?['pending'] == true,
        isPro: raw?['isPro'] == true,
      );
    } on MissingPluginException {
      throw const AppStoreIapException('UNAVAILABLE', 'IAP plugin missing');
    } on PlatformException catch (error) {
      throw AppStoreIapException(
        error.code,
        error.message ?? error.code,
      );
    }
  }

  @override
  Future<bool> restore() async {
    if (!isAppStoreIapAvailable) return false;
    try {
      final raw = await _channel.invokeMethod<Map<dynamic, dynamic>>('restore');
      return raw?['isPro'] == true;
    } on MissingPluginException {
      return false;
    } on PlatformException catch (error) {
      throw AppStoreIapException(
        error.code,
        error.message ?? error.code,
      );
    }
  }
}
