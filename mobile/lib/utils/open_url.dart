import 'package:url_launcher/url_launcher.dart';

bool isExternalHref(String href) {
  final value = href.trim();
  if (value.isEmpty ||
      value.startsWith('#') ||
      value.toLowerCase().startsWith('javascript:')) {
    return false;
  }
  try {
    final url = Uri.parse(value);
    return url.scheme == 'http' || url.scheme == 'https' || url.scheme == 'mailto';
  } catch (_) {
    return RegExp(r'^(https?:|mailto:)', caseSensitive: false).hasMatch(value);
  }
}

Future<bool> openExternalUrl(String url) async {
  final uri = Uri.tryParse(url.trim());
  if (uri == null) return false;

  Future<bool> tryLaunch(LaunchMode mode) async {
    try {
      return await launchUrl(uri, mode: mode);
    } catch (_) {
      return false;
    }
  }

  return await tryLaunch(LaunchMode.externalApplication) ||
      await tryLaunch(LaunchMode.platformDefault) ||
      await tryLaunch(LaunchMode.inAppBrowserView);
}
