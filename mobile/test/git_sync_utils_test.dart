import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/services/git_providers.dart';
import 'package:tinynote_mobile/utils/sync_conflict_name.dart';

void main() {
  group('toHttpsRemoteUrl', () {
    test('keeps https urls', () {
      expect(
        toHttpsRemoteUrl(' https://github.com/user/notes.git '),
        'https://github.com/user/notes.git',
      );
    });

    test('converts ssh host alias', () {
      expect(
        toHttpsRemoteUrl('git@github.com:user/notes.git'),
        'https://github.com/user/notes.git',
      );
    });

    test('converts ssh:// urls', () {
      expect(
        toHttpsRemoteUrl('ssh://git@gitee.com/user/notes.git'),
        'https://gitee.com/user/notes.git',
      );
    });
  });

  group('inferGitProvider', () {
    test('detects common hosts', () {
      expect(inferGitProvider('https://github.com/a/b.git'), GitRemoteProvider.github);
      expect(inferGitProvider('https://gitee.com/a/b.git'), GitRemoteProvider.gitee);
      expect(inferGitProvider('https://gitlab.com/a/b.git'), GitRemoteProvider.gitlab);
      expect(
        inferGitProvider('https://git.wu2kong.com/a/b.git'),
        GitRemoteProvider.tinynote,
      );
      expect(inferGitProvider('https://git.example.com/a/b.git'), GitRemoteProvider.custom);
    });
  });

  group('authForProvider', () {
    test('uses provider-specific usernames', () {
      expect(authForProvider(GitRemoteProvider.github, 'tok').username, 'x-access-token');
      expect(authForProvider(GitRemoteProvider.gitee, 'tok').username, 'oauth2');
      expect(authForProvider(GitRemoteProvider.gitlab, 'tok').username, 'oauth2');
      expect(authForProvider(GitRemoteProvider.custom, 'tok').username, 'git');
      expect(
        authForProvider(GitRemoteProvider.custom, 'tok', username: 'alice').username,
        'alice',
      );
      expect(authForProvider(GitRemoteProvider.github, ' tok ').password, 'tok');
    });
  });

  group('sync conflict names', () {
    test('allocates numbered copies', () async {
      expect(withConflictCopyCount('（冲突版本 2026-08-24）', 1), '（冲突版本 2026-08-24）');
      expect(withConflictCopyCount('（冲突版本 2026-08-24）', 2), '（冲突版本 2026-08-24 2）');
      expect(
        withConflictCopyCount(' (conflict version 2026-08-24)', 3),
        ' (conflict version 2026-08-24 3)',
      );

      final taken = {'space/note（冲突版本 2026-08-24）.md'};
      final path = await allocateConflictCopyPath(
        relativePath: 'space/note.md',
        suffix: '（冲突版本 2026-08-24）',
        exists: (candidate) async => taken.contains(candidate),
      );
      expect(path, 'space/note（冲突版本 2026-08-24 2）.md');
    });
  });
}
