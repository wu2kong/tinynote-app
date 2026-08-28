import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:git2dart/git2dart.dart';
import 'package:path_provider/path_provider.dart';

const _caBundleAsset = 'packages/git2dart_binaries/assets/certs/cacert.pem';

final Set<String> _systemTrustedHosts = <String>{};
var _caBundleReady = false;

/// Host of an HTTPS Git URL, or null when it cannot be parsed.
String? gitHttpsHost(String url) {
  try {
    final host = Uri.parse(url).host.trim().toLowerCase();
    return host.isEmpty ? null : host;
  } catch (_) {
    return null;
  }
}

/// libgit2 OpenSSL on iOS has no system CA store. Accept the cert when
/// libgit2 already trusts it, or when this device's system TLS stack does.
bool acceptGitTlsCertificate({
  required bool libgit2Valid,
  required String host,
  Set<String>? systemTrustedHosts,
}) {
  if (libgit2Valid) return true;
  final normalized = host.trim().toLowerCase();
  if (normalized.isEmpty) return false;
  return (systemTrustedHosts ?? _systemTrustedHosts).contains(normalized);
}

/// Point libgit2 at the Mozilla CA bundle (same asset Android already uses).
Future<void> configureLibgit2Certificates() async {
  if (_caBundleReady) return;
  if (!Platform.isIOS) {
    _caBundleReady = true;
    return;
  }

  try {
    Libgit2.version;
    final cacheDir = await getTemporaryDirectory();
    final certFile = File('${cacheDir.path}/tinynote-cacert.pem');
    final data = await rootBundle.load(_caBundleAsset);
    await certFile.writeAsBytes(
      data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
      flush: true,
    );
    Libgit2.setSSLCertLocations(file: certFile.path);
  } catch (error, stack) {
    debugPrint('Git SSL CA bundle setup failed: $error\n$stack');
  } finally {
    _caBundleReady = true;
  }
}

/// Probe the host with the OS TLS stack so iOS can trust CAs OpenSSL lacks.
Future<void> trustGitHostFromUrl(String url) async {
  final host = gitHttpsHost(url);
  if (host == null || _systemTrustedHosts.contains(host)) return;

  SecureSocket? socket;
  try {
    socket = await SecureSocket.connect(
      host,
      443,
      timeout: const Duration(seconds: 12),
    );
    _systemTrustedHosts.add(host);
  } catch (error) {
    debugPrint('Git TLS preflight failed for $host: $error');
  } finally {
    socket?.destroy();
  }
}

@visibleForTesting
void debugResetGitSslState() {
  _systemTrustedHosts.clear();
  _caBundleReady = false;
}

@visibleForTesting
void debugTrustGitHost(String host) {
  final normalized = host.trim().toLowerCase();
  if (normalized.isNotEmpty) _systemTrustedHosts.add(normalized);
}
