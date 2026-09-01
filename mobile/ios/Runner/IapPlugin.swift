import Flutter
import StoreKit

/// StoreKit 2 bridge matching the Mac App Store IAP product IDs and flow.
final class IapPlugin: NSObject {
  static let channelName = "com.wu2kong.tinynote/iap"
  private static let shared = IapPlugin()

  static let productIds: Set<String> = [
    "com.wu2kong.tinynote.app.pro.monthly",
    "com.wu2kong.tinynote.app.pro.yearly",
    "com.wu2kong.tinynote.app.pro.lifetime",
  ]

  private static let productOrder = [
    "com.wu2kong.tinynote.app.pro.monthly",
    "com.wu2kong.tinynote.app.pro.yearly",
    "com.wu2kong.tinynote.app.pro.lifetime",
  ]

  private var updatesTask: Task<Void, Never>?

  static func register(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
    shared.startListening()
    channel.setMethodCallHandler { call, result in
      shared.handle(call, result: result)
    }
  }

  private func startListening() {
    guard updatesTask == nil else { return }
    updatesTask = Task { [weak self] in
      for await update in Transaction.updates {
        guard self != nil else { break }
        if let transaction = try? Self.verified(update) {
          await transaction.finish()
        }
      }
    }
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "getProducts":
      Task { await self.getProducts(result: result) }
    case "getEntitlement":
      Task { await self.getEntitlement(result: result) }
    case "purchase":
      let productId = Self.stringArgument(call, key: "productId")
      guard let productId, Self.productIds.contains(productId) else {
        result(FlutterError(
          code: "NOT_FOUND",
          message: "Unknown product",
          details: nil
        ))
        return
      }
      Task { await self.purchase(productId: productId, result: result) }
    case "restore":
      Task { await self.restore(result: result) }
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func getProducts(result: @escaping FlutterResult) async {
    do {
      let products = try await Product.products(for: Self.productIds)
      let byId = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
      let payload = Self.productOrder.compactMap { id -> [String: Any]? in
        guard let product = byId[id] else { return nil }
        return [
          "productId": product.id,
          "title": product.displayName,
          "description": product.description,
          "formattedPrice": product.displayPrice,
        ]
      }
      await MainActor.run { result(payload) }
    } catch {
      await MainActor.run {
        result(FlutterError(
          code: "PRODUCTS_FAILED",
          message: error.localizedDescription,
          details: nil
        ))
      }
    }
  }

  private func getEntitlement(result: @escaping FlutterResult) async {
    do {
      let isPro = try await Self.hasActiveEntitlement()
      await MainActor.run { result(["isPro": isPro]) }
    } catch {
      await MainActor.run {
        result(FlutterError(
          code: "ENTITLEMENT_FAILED",
          message: error.localizedDescription,
          details: nil
        ))
      }
    }
  }

  private func purchase(productId: String, result: @escaping FlutterResult) async {
    do {
      let products = try await Product.products(for: [productId])
      guard let product = products.first else {
        await MainActor.run {
          result(FlutterError(
            code: "NOT_FOUND",
            message: "Product is not available",
            details: nil
          ))
        }
        return
      }

      let purchaseResult = try await product.purchase()
      switch purchaseResult {
      case .success(let verification):
        let transaction = try Self.verified(verification)
        await transaction.finish()
        let isPro = try await Self.hasActiveEntitlement()
        await MainActor.run {
          result([
            "purchased": true,
            "cancelled": false,
            "pending": false,
            "isPro": isPro,
          ])
        }
      case .userCancelled:
        await MainActor.run {
          result([
            "purchased": false,
            "cancelled": true,
            "pending": false,
            "isPro": false,
          ])
        }
      case .pending:
        await MainActor.run {
          result([
            "purchased": false,
            "cancelled": false,
            "pending": true,
            "isPro": false,
          ])
        }
      @unknown default:
        await MainActor.run {
          result(FlutterError(
            code: "PURCHASE_FAILED",
            message: "Purchase did not complete",
            details: nil
          ))
        }
      }
    } catch {
      await MainActor.run {
        result(FlutterError(
          code: "PURCHASE_FAILED",
          message: error.localizedDescription,
          details: nil
        ))
      }
    }
  }

  private func restore(result: @escaping FlutterResult) async {
    do {
      try await AppStore.sync()
      let isPro = try await Self.hasActiveEntitlement()
      await MainActor.run { result(["isPro": isPro]) }
    } catch {
      await MainActor.run {
        result(FlutterError(
          code: "RESTORE_FAILED",
          message: error.localizedDescription,
          details: nil
        ))
      }
    }
  }

  private static func hasActiveEntitlement() async throws -> Bool {
    for await entitlement in Transaction.currentEntitlements {
      let transaction = try verified(entitlement)
      if productIds.contains(transaction.productID) {
        return true
      }
    }
    return false
  }

  private static func verified<T>(_ result: VerificationResult<T>) throws -> T {
    switch result {
    case .unverified(_, let error):
      throw error
    case .verified(let value):
      return value
    }
  }

  private static func stringArgument(_ call: FlutterMethodCall, key: String) -> String? {
    if let value = call.arguments as? String {
      return value
    }
    if let map = call.arguments as? [String: Any], let value = map[key] as? String {
      return value
    }
    return nil
  }
}
