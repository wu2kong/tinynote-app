import Flutter
import UIKit
import UniformTypeIdentifiers

/// Lets the user pick an iCloud Drive / Files folder without the paid-team iCloud entitlement.
/// Access is persisted via a security-scoped bookmark.
final class ICloudPlugin: NSObject, UIDocumentPickerDelegate {
  static let channelName = "com.wu2kong.tinynote/icloud"
  private static let bookmarkKey = "tinynote.libraryFolderBookmark"
  private static let shared = ICloudPlugin()

  private var pendingResult: FlutterResult?
  private var accessedURL: URL?

  static func register(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      shared.handle(call, result: result)
    }
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "isAvailable":
      // Files picker works on personal teams; no ubiquity container required.
      result(true)
    case "hasBookmarkedLibrary":
      result(UserDefaults.standard.data(forKey: Self.bookmarkKey) != nil)
    case "pickLibraryFolder":
      pickLibraryFolder(result: result)
    case "restoreLibraryAccess":
      do {
        result(try restoreLibraryAccess())
      } catch {
        result(FlutterError(
          code: "BOOKMARK_ERROR",
          message: error.localizedDescription,
          details: nil
        ))
      }
    case "clearLibraryBookmark":
      clearLibraryBookmark()
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func pickLibraryFolder(result: @escaping FlutterResult) {
    if pendingResult != nil {
      result(FlutterError(
        code: "BUSY",
        message: "已有文件夹选择进行中",
        details: nil
      ))
      return
    }

    guard let presenter = Self.topViewController() else {
      result(FlutterError(
        code: "NO_UI",
        message: "无法打开文件夹选择器",
        details: nil
      ))
      return
    }

    pendingResult = result
    let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder])
    picker.allowsMultipleSelection = false
    picker.delegate = self
    presenter.present(picker, animated: true)
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    defer { pendingResult = nil }
    guard let url = urls.first else {
      pendingResult?(nil)
      return
    }

    // Must start security-scoped access before creating a bookmark.
    guard url.startAccessingSecurityScopedResource() else {
      pendingResult?(FlutterError(
        code: "ACCESS_DENIED",
        message: "无法访问所选文件夹",
        details: nil
      ))
      return
    }

    do {
      // On iOS, security scope is implicit — do not use .withSecurityScope (macOS-only).
      let bookmark = try url.bookmarkData(
        options: [],
        includingResourceValuesForKeys: nil,
        relativeTo: nil
      )
      UserDefaults.standard.set(bookmark, forKey: Self.bookmarkKey)

      // Keep this access alive for the rest of the app session.
      accessedURL?.stopAccessingSecurityScopedResource()
      accessedURL = url
      pendingResult?(url.path)
    } catch {
      url.stopAccessingSecurityScopedResource()
      pendingResult?(FlutterError(
        code: "BOOKMARK_ERROR",
        message: error.localizedDescription,
        details: nil
      ))
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    pendingResult?(nil)
    pendingResult = nil
  }

  private func restoreLibraryAccess() throws -> String? {
    guard let data = UserDefaults.standard.data(forKey: Self.bookmarkKey) else {
      return nil
    }

    var isStale = false
    let url = try URL(
      resolvingBookmarkData: data,
      options: [.withoutUI],
      relativeTo: nil,
      bookmarkDataIsStale: &isStale
    )

    accessedURL?.stopAccessingSecurityScopedResource()
    guard url.startAccessingSecurityScopedResource() else {
      throw FolderAccessError.cannotAccess
    }
    accessedURL = url

    if isStale {
      let refreshed = try url.bookmarkData(
        options: [],
        includingResourceValuesForKeys: nil,
        relativeTo: nil
      )
      UserDefaults.standard.set(refreshed, forKey: Self.bookmarkKey)
    }

    return url.path
  }

  private func clearLibraryBookmark() {
    accessedURL?.stopAccessingSecurityScopedResource()
    accessedURL = nil
    UserDefaults.standard.removeObject(forKey: Self.bookmarkKey)
  }

  private static func topViewController(base: UIViewController? = nil) -> UIViewController? {
    let root: UIViewController?
    if let base {
      root = base
    } else {
      let keyWindow = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap(\.windows)
        .first(where: \.isKeyWindow)
      root = keyWindow?.rootViewController
    }

    if let nav = root as? UINavigationController {
      return topViewController(base: nav.visibleViewController)
    }
    if let tab = root as? UITabBarController {
      return topViewController(base: tab.selectedViewController)
    }
    if let presented = root?.presentedViewController {
      return topViewController(base: presented)
    }
    return root
  }
}

private enum FolderAccessError: LocalizedError {
  case cannotAccess

  var errorDescription: String? {
    switch self {
    case .cannotAccess:
      return "无法访问所选文件夹，请重新选择"
    }
  }
}
