import 'package:shared_preferences/shared_preferences.dart';

class GitSyncConfig {
  const GitSyncConfig({
    required this.connected,
    required this.url,
    required this.token,
    required this.username,
    required this.remoteName,
  });

  final bool connected;
  final String url;
  final String token;
  final String username;
  final String remoteName;

  static const empty = GitSyncConfig(
    connected: false,
    url: '',
    token: '',
    username: '',
    remoteName: 'origin',
  );

  GitSyncConfig copyWith({
    bool? connected,
    String? url,
    String? token,
    String? username,
    String? remoteName,
  }) {
    return GitSyncConfig(
      connected: connected ?? this.connected,
      url: url ?? this.url,
      token: token ?? this.token,
      username: username ?? this.username,
      remoteName: remoteName ?? this.remoteName,
    );
  }
}

class GitSyncConfigStore {
  static const _connectedKey = 'tinynote.git.connected';
  static const _urlKey = 'tinynote.git.url';
  static const _tokenKey = 'tinynote.git.token';
  static const _usernameKey = 'tinynote.git.username';
  static const _remoteNameKey = 'tinynote.git.remoteName';

  Future<GitSyncConfig> load() async {
    final prefs = await SharedPreferences.getInstance();
    return GitSyncConfig(
      connected: prefs.getBool(_connectedKey) ?? false,
      url: prefs.getString(_urlKey) ?? '',
      token: prefs.getString(_tokenKey) ?? '',
      username: prefs.getString(_usernameKey) ?? '',
      remoteName: prefs.getString(_remoteNameKey) ?? 'origin',
    );
  }

  Future<void> save(GitSyncConfig config) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_connectedKey, config.connected);
    await prefs.setString(_urlKey, config.url);
    await prefs.setString(_tokenKey, config.token);
    await prefs.setString(_usernameKey, config.username);
    await prefs.setString(_remoteNameKey, config.remoteName);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_connectedKey);
    await prefs.remove(_urlKey);
    await prefs.remove(_tokenKey);
    await prefs.remove(_usernameKey);
    await prefs.remove(_remoteNameKey);
  }
}
