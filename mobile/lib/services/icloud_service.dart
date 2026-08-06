import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../l10n/l10n.dart';

/// iOS Files / iCloud Drive folder access via security-scoped bookmarks.
///
/// Does **not** require the paid-team iCloud container entitlement.
class ICloudService {
  ICloudService._();

  static const _channel = MethodChannel('com.wu2kong.tinynote/icloud');

  static bool get isSupported => !kIsWeb && Platform.isIOS;

  static Future<bool> isAvailable() async {
    if (!isSupported) return false;
    try {
      final result = await _channel.invokeMethod<bool>('isAvailable');
      return result ?? false;
    } on PlatformException catch (error) {
      debugPrint('iCloud isAvailable failed: $error');
      return false;
    }
  }

  static Future<bool> hasBookmarkedLibrary() async {
    if (!isSupported) return false;
    try {
      final result = await _channel.invokeMethod<bool>('hasBookmarkedLibrary');
      return result ?? false;
    } on PlatformException catch (error) {
      debugPrint('iCloud hasBookmarkedLibrary failed: $error');
      return false;
    }
  }

  /// Opens the system folder picker. Returns `null` if the user cancels.
  static Future<String?> pickLibraryFolder() async {
    if (!isSupported) {
      throw StateError(appStrings.iCloudFilesUnsupported);
    }
    try {
      return await _channel.invokeMethod<String>('pickLibraryFolder');
    } on PlatformException catch (error) {
      throw StateError(error.message ?? appStrings.pickFolderFailed);
    }
  }

  /// Restores previously bookmarked folder access for this app session.
  static Future<String?> restoreLibraryAccess() async {
    if (!isSupported) return null;
    try {
      return await _channel.invokeMethod<String>('restoreLibraryAccess');
    } on PlatformException catch (error) {
      debugPrint('iCloud restoreLibraryAccess failed: $error');
      return null;
    }
  }

  static Future<void> clearLibraryBookmark() async {
    if (!isSupported) return;
    try {
      await _channel.invokeMethod<void>('clearLibraryBookmark');
    } on PlatformException catch (error) {
      debugPrint('iCloud clearLibraryBookmark failed: $error');
    }
  }
}
