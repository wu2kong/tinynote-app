import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/constants/app_store_iap.dart';
import 'package:tinynote_mobile/constants/pro.dart';
import 'package:tinynote_mobile/core/notebook_format.dart';
import 'package:tinynote_mobile/services/app_store_iap.dart';
import 'package:tinynote_mobile/services/license_store.dart';

class _FakeIap implements AppStoreIapClient {
  _FakeIap({
    this.products = const [],
    this.purchaseResult = const AppStorePurchaseResult(
      purchased: true,
      cancelled: false,
      pending: false,
      isPro: true,
    ),
  });

  List<AppStoreProduct> products;
  bool isPro = false;
  AppStorePurchaseResult purchaseResult;

  @override
  Future<List<AppStoreProduct>> getProducts() async => products;

  @override
  Future<bool> getEntitlement() async => isPro;

  @override
  Future<AppStorePurchaseResult> purchase(String productId) async {
    if (purchaseResult.purchased) isPro = purchaseResult.isPro;
    return purchaseResult;
  }

  @override
  Future<bool> restore() async => isPro;
}

void main() {
  test('purchase unlocks Pro and closes the gate', () async {
    final iap = _FakeIap(
      products: const [
        AppStoreProduct(
          productId: appStoreYearlyProductId,
          title: 'Yearly',
          description: 'Yearly Pro',
          formattedPrice: '¥68',
        ),
      ],
    );
    final store = LicenseStore(iap: iap);

    expect(store.requirePro(ProFeature.sync), isFalse);
    expect(store.gateOpen, isTrue);

    final ok = await store.purchase(appStoreYearlyProductId);
    expect(ok, isTrue);
    expect(store.isPro, isTrue);
    expect(store.gateOpen, isFalse);
    expect(store.priceFor(appStoreYearlyProductId), '¥68');
  });

  test('cancelled purchase does not unlock Pro', () async {
    final store = LicenseStore(
      iap: _FakeIap(
        purchaseResult: const AppStorePurchaseResult(
          purchased: false,
          cancelled: true,
          pending: false,
          isPro: false,
        ),
      ),
    );

    expect(await store.purchase(appStoreMonthlyProductId), isFalse);
    expect(store.isPro, isFalse);
    expect(store.error, isNull);
  });

  test('article gate keeps parent path and format', () {
    final store = LicenseStore(iap: _FakeIap());
    store.openGate(
      ProFeature.articleNotebook,
      context: const GateContext(
        parentPath: '/notes/Work',
        format: NotebookFormat.writer,
      ),
    );
    expect(store.gateFeature, ProFeature.articleNotebook);
    expect(store.gateContext?.format, NotebookFormat.writer);
    expect(store.gateContext?.parentPath, '/notes/Work');
  });
}
