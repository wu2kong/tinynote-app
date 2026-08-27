const tinynoteGitHost = 'https://git.wu2kong.com';

enum GitRemoteProvider {
  github,
  gitee,
  gitlab,
  codeup,
  atomgit,
  tinynote,
  custom,
}

class GitHttpsAuth {
  const GitHttpsAuth({required this.username, required this.password});

  final String username;
  final String password;
}

String toHttpsRemoteUrl(String url) {
  final trimmed = url.trim();
  if (RegExp(r'^https?://', caseSensitive: false).hasMatch(trimmed)) {
    return trimmed;
  }
  final sshHost = RegExp(r'^git@([^:]+):(.+)$').firstMatch(trimmed);
  if (sshHost != null) {
    return 'https://${sshHost.group(1)}/${sshHost.group(2)!.replaceFirst(RegExp(r'^/+'), '')}';
  }
  final sshUrl = RegExp(r'^ssh://(?:git@)?([^/]+)/(.+)$').firstMatch(trimmed);
  if (sshUrl != null) {
    return 'https://${sshUrl.group(1)}/${sshUrl.group(2)}';
  }
  return trimmed;
}

bool isHttpsGitUrl(String url) {
  final value = toHttpsRemoteUrl(url);
  return RegExp(r'^https://', caseSensitive: false).hasMatch(value);
}

GitRemoteProvider inferGitProvider(String url) {
  final value = url.trim().toLowerCase();
  if (value.isEmpty) return GitRemoteProvider.custom;
  if (value.contains('github.com')) return GitRemoteProvider.github;
  if (value.contains('gitee.com')) return GitRemoteProvider.gitee;
  if (value.contains('codeup.aliyun.com') || value.contains('codeup.aliyun')) {
    return GitRemoteProvider.codeup;
  }
  if (value.contains('gitcode.com') || value.contains('atomgit.com')) {
    return GitRemoteProvider.atomgit;
  }
  if (value.contains('gitlab.com') || RegExp(r'gitlab\.').hasMatch(value)) {
    return GitRemoteProvider.gitlab;
  }
  final host = tinynoteGitHost.replaceFirst(RegExp(r'^https?://'), '').toLowerCase();
  if (value.contains('tinynote') ||
      value.contains('git.wu2kong.com') ||
      value.contains(host)) {
    return GitRemoteProvider.tinynote;
  }
  return GitRemoteProvider.custom;
}

GitHttpsAuth authForProvider(
  GitRemoteProvider provider,
  String token, {
  String? username,
}) {
  final trimmedToken = token.trim();
  final customUser = username?.trim() ?? '';
  switch (provider) {
    case GitRemoteProvider.github:
      return GitHttpsAuth(username: 'x-access-token', password: trimmedToken);
    case GitRemoteProvider.gitee:
    case GitRemoteProvider.gitlab:
      return GitHttpsAuth(username: 'oauth2', password: trimmedToken);
    case GitRemoteProvider.codeup:
    case GitRemoteProvider.atomgit:
    case GitRemoteProvider.tinynote:
      return GitHttpsAuth(
        username: customUser.isEmpty ? 'oauth2' : customUser,
        password: trimmedToken,
      );
    case GitRemoteProvider.custom:
      return GitHttpsAuth(
        username: customUser.isEmpty ? 'git' : customUser,
        password: trimmedToken,
      );
  }
}

String tokenCreateUrl(GitRemoteProvider provider) {
  switch (provider) {
    case GitRemoteProvider.github:
      return 'https://github.com/settings/tokens/new?scopes=repo&description=TinyNote';
    case GitRemoteProvider.gitee:
      return 'https://gitee.com/personal_access_tokens';
    case GitRemoteProvider.gitlab:
      return 'https://gitlab.com/-/user_settings/personal_access_tokens?name=TinyNote&scopes=api,write_repository';
    case GitRemoteProvider.codeup:
      return 'https://account-devops.aliyun.com/settings/personalAccessTokenCreate';
    case GitRemoteProvider.atomgit:
      return 'https://gitcode.com/setting/token-classic/create';
    case GitRemoteProvider.tinynote:
      return '$tinynoteGitHost/user/settings/applications';
    case GitRemoteProvider.custom:
      return '';
  }
}
