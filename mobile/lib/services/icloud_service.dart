import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

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
      throw StateError('当前平台不支持通过 Files 选择同步文件夹');
    }
    try {
      return await _channel.invokeMethod<String>('pickLibraryFolder');
    } on PlatformException catch (error) {
      throw StateError(error.message ?? '选择文件夹失败');
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
