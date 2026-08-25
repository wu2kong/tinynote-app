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
  private var pendingKind: PickKind = .library
  private var accessedURL: URL?

  private enum PickKind {
    case library
    case importFolder
  }

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
      pickFolder(kind: .library, result: result)
    case "pickImportFolder":
      pickFolder(kind: .importFolder, result: result)
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

  private func pickFolder(kind: PickKind, result: @escaping FlutterResult) {
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
    pendingKind = kind
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

    guard url.startAccessingSecurityScopedResource() else {
      pendingResult?(FlutterError(
        code: "ACCESS_DENIED",
        message: "无法访问所选文件夹",
        details: nil
      ))
      return
    }

    if pendingKind == .importFolder {
      handleImportFolder(url)
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

  private func handleImportFolder(_ url: URL) {
    defer { url.stopAccessingSecurityScopedResource() }

    var coordinatorError: NSError?
    var copiedPath: String?
    var copyError: Error?
    NSFileCoordinator().coordinate(
      readingItemAt: url,
      options: [],
      error: &coordinatorError
    ) { readable in
      do {
        copiedPath = try self.copyMarkdownFolder(from: readable)
      } catch {
        copyError = error
      }
    }

    if let coordinatorError {
      pendingResult?(FlutterError(
        code: "ACCESS_DENIED",
        message: coordinatorError.localizedDescription,
        details: nil
      ))
      return
    }
    if let copyError {
      pendingResult?(FlutterError(
        code: "COPY_FAILED",
        message: copyError.localizedDescription,
        details: nil
      ))
      return
    }
    pendingResult?(copiedPath)
  }

  /// Copy `.md` files into a sandbox temp folder so Dart can read them
  /// without keeping the security-scoped URL alive.
  private func copyMarkdownFolder(from source: URL) throws -> String {
    let fileManager = FileManager.default
    let tempRoot = fileManager.temporaryDirectory
      .appendingPathComponent("tinynote-import-\(UUID().uuidString)", isDirectory: true)
      .appendingPathComponent(source.lastPathComponent, isDirectory: true)
    try fileManager.createDirectory(at: tempRoot, withIntermediateDirectories: true)

    guard let enumerator = fileManager.enumerator(
      at: source,
      includingPropertiesForKeys: [.isDirectoryKey],
      options: [.skipsHiddenFiles]
    ) else {
      return tempRoot.path
    }

    let rootPath = source.standardizedFileURL.path
    while let item = enumerator.nextObject() as? URL {
      let name = item.lastPathComponent
      let values = try item.resourceValues(forKeys: [.isDirectoryKey])
      if values.isDirectory == true {
        if name.hasSuffix(".tinynotes") {
          enumerator.skipDescendants()
        }
        continue
      }
      guard item.pathExtension.lowercased() == "md" else { continue }

      var relative = item.standardizedFileURL.path
      if relative.hasPrefix(rootPath) {
        relative = String(relative.dropFirst(rootPath.count))
      }
      relative = relative.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
      if relative.isEmpty {
        relative = item.lastPathComponent
      }

      let destination = tempRoot.appendingPathComponent(relative)
      try fileManager.createDirectory(
        at: destination.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      if fileManager.fileExists(atPath: destination.path) {
        try fileManager.removeItem(at: destination)
      }
      try fileManager.copyItem(at: item, to: destination)
    }

    return tempRoot.path
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
