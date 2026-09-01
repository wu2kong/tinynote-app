import 'package:flutter/widgets.dart';

import '../constants/app_store_iap.dart';
import '../constants/pro.dart';
import '../l10n/l10n.dart';
import 'app_store_iap.dart';

LicenseStore? appLicenseStore;

class LicenseStore extends ChangeNotifier {
  LicenseStore({AppStoreIapClient? iap}) : _iap = iap ?? AppStoreIap();

  final AppStoreIapClient _iap;

  bool hydrated = false;
  bool isPro = false;
  bool busy = false;
  String? error;
  List<AppStoreProduct> products = const [];
  bool gateOpen = false;
  ProFeature? gateFeature;
  GateContext? gateContext;

  String priceFor(String productId) {
    for (final product in products) {
      final price = product.formattedPrice;
      if (product.productId == productId && price != null && price.isNotEmpty) {
        return price;
      }
    }
    return appStoreFallbackPrices[productId] ?? productId;
  }

  Future<void> hydrate() async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await _refreshEntitlements();
    } finally {
      busy = false;
      hydrated = true;
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    if (busy) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await _refreshEntitlements();
    } finally {
      busy = false;
      hydrated = true;
      notifyListeners();
    }
  }

  Future<bool> purchase(String productId) async {
    if (busy) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final result = await _iap.purchase(productId);
      if (result.cancelled) return false;
      if (result.pending) {
        error = appStrings.proPurchasePending;
        return false;
      }
      if (!result.purchased) {
        error = appStrings.proPurchaseIncomplete;
        return false;
      }
      await _refreshEntitlements();
      if (isPro) {
        closeGate();
        return true;
      }
      error = appStrings.proPurchaseNotSynced;
      return false;
    } on AppStoreIapException catch (caught) {
      error = _mapError(caught);
      return false;
    } catch (caught) {
      error = caught.toString();
      return false;
    } finally {
      busy = false;
      hydrated = true;
      notifyListeners();
    }
  }

  Future<bool> restore() async {
    if (busy) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await _iap.restore();
      await _refreshEntitlements();
      return isPro;
    } on AppStoreIapException catch (caught) {
      error = _mapError(caught);
      return false;
    } catch (caught) {
      error = caught.toString();
      return false;
    } finally {
      busy = false;
      hydrated = true;
      notifyListeners();
    }
  }

  void openGate(ProFeature feature, {GateContext? context}) {
    gateOpen = true;
    gateFeature = feature;
    gateContext = context;
    notifyListeners();
  }

  void closeGate() {
    gateOpen = false;
    gateFeature = null;
    gateContext = null;
    notifyListeners();
  }

  bool requirePro(ProFeature feature, {GateContext? context}) {
    if (isPro) return true;
    openGate(feature, context: context);
    return false;
  }

  Future<void> _refreshEntitlements() async {
    try {
      final loaded = await Future.wait([
        _iap.getProducts(),
        _iap.getEntitlement(),
      ]);
      products = loaded[0] as List<AppStoreProduct>;
      isPro = loaded[1] as bool;
      error = null;
    } on AppStoreIapException catch (caught) {
      error = _mapError(caught);
    } catch (caught) {
      error = caught.toString();
    }
  }

  String _mapError(AppStoreIapException caught) {
    if (caught.code == 'UNAVAILABLE') {
      return appStrings.proPurchaseUnavailable;
    }
    return caught.message;
  }
}

class LicenseScope extends InheritedNotifier<LicenseStore> {
  const LicenseScope({
    super.key,
    required LicenseStore store,
    required super.child,
  }) : super(notifier: store);

  static LicenseStore of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<LicenseScope>();
    assert(scope != null, 'LicenseScope not found in widget tree');
    return scope!.notifier!;
  }

  static LicenseStore? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<LicenseScope>()?.notifier;
  }
}

extension LicenseBuildContext on BuildContext {
  LicenseStore get license => LicenseScope.of(this);
}
