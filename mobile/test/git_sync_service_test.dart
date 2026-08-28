import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:git2dart/git2dart.dart';
import 'package:path/path.dart' as p;
import 'package:tinynote_mobile/services/git_sync_config.dart';
import 'package:tinynote_mobile/services/git_sync_service.dart';
import 'package:tinynote_mobile/utils/git_oid.dart';

void main() {
  test('init, commit, and status work on a local library', () async {
    final dir = await _tempDir();

    await File(p.join(dir.path, 'Demo.tinynotes', 'hello.writer.md'))
        .create(recursive: true)
        .then((file) => file.writeAsString('# hello\n'));

    final service = GitSyncService();
    expect(await service.isRepository(dir.path), isFalse);

    _commitWorkingTree(dir.path, message: 'Initialize TinyNote library');

    expect(await service.isRepository(dir.path), isTrue);

    const config = GitSyncConfig(
      connected: false,
      url: '',
      token: '',
      username: '',
      remoteName: 'origin',
    );
    final after = await service.status(dir.path, config);
    expect(after.isRepo, isTrue);
    expect(after.hasRemote, isFalse);
    expect(after.branch, 'main');
  });

  test('copied oid can be looked up after the reference is freed', () async {
    final dir = await _tempDir();
    await File(p.join(dir.path, 'note.md')).writeAsString('hello\n');
    _commitWorkingTree(dir.path, message: 'init');

    final repo = Repository.open(dir.path);
    try {
      final ref = Reference.lookup(repo: repo, name: 'HEAD');
      final copied = copyGitOid(ref.target);
      expect(copied, isNotNull);
      expect(isZeroGitOid(copied!), isFalse);
      ref.free();

      final commit = Commit.lookup(repo: repo, oid: copied);
      expect(commit.message.trim(), 'init');
      commit.free();
    } finally {
      repo.free();
    }
  });

  test('isZeroGitOid detects the all-zero object id', () {
    const zeros = '0000000000000000000000000000000000000000';
    expect(isZeroGitOid(Oid.fromSHAParse(zeros)), isTrue);
    expect(
      isZeroGitOid(Oid.fromSHAParse('4b825dc642cb6eb9a060e54bf8d69288fbee4904')),
      isFalse,
    );
  });

  test('pull checkouts an unborn local branch onto a file remote', () async {
    final remoteDir = await _tempDir('tinynote-git-remote-');
    await File(p.join(remoteDir.path, 'from-remote.md')).writeAsString('cloud\n');
    _commitWorkingTree(remoteDir.path, message: 'remote notes');

    final localDir = await _tempDir('tinynote-git-local-');
    Repository.init(path: localDir.path, initialHead: 'main').free();
    _addFileRemote(localDir.path, remoteDir.path);

    final outcome = await GitSyncService().pull(
      libraryPath: localDir.path,
      config: _fileConfig(remoteDir.path),
      conflictSuffix: ' (conflict)',
    );
    expect(outcome.conflictCopies, isEmpty);
    expect(
      await File(p.join(localDir.path, 'from-remote.md')).readAsString(),
      'cloud\n',
    );
  });

  test('pull merges unrelated local and remote histories', () async {
    final remoteDir = await _tempDir('tinynote-git-remote-');
    await File(p.join(remoteDir.path, 'from-remote.md')).writeAsString('cloud\n');
    _commitWorkingTree(remoteDir.path, message: 'remote notes');

    final localDir = await _tempDir('tinynote-git-local-');
    await File(p.join(localDir.path, 'from-local.md')).writeAsString('pad\n');
    _commitWorkingTree(localDir.path, message: 'local notes');
    _addFileRemote(localDir.path, remoteDir.path);

    await GitSyncService().pull(
      libraryPath: localDir.path,
      config: _fileConfig(remoteDir.path),
      conflictSuffix: ' (conflict)',
    );

    expect(await File(p.join(localDir.path, 'from-local.md')).readAsString(), 'pad\n');
    expect(
      await File(p.join(localDir.path, 'from-remote.md')).readAsString(),
      'cloud\n',
    );
  });

  test('pull saves a local copy when the same file differs', () async {
    final remoteDir = await _tempDir('tinynote-git-remote-');
    await File(p.join(remoteDir.path, 'shared.md')).writeAsString('cloud\n');
    _commitWorkingTree(remoteDir.path, message: 'remote notes');

    final localDir = await _tempDir('tinynote-git-local-');
    await File(p.join(localDir.path, 'shared.md')).writeAsString('pad\n');
    _commitWorkingTree(localDir.path, message: 'local notes');
    _addFileRemote(localDir.path, remoteDir.path);

    final outcome = await GitSyncService().pull(
      libraryPath: localDir.path,
      config: _fileConfig(remoteDir.path),
      conflictSuffix: ' (conflict)',
    );

    expect(await File(p.join(localDir.path, 'shared.md')).readAsString(), 'cloud\n');
    expect(outcome.conflictCopies, isNotEmpty);
    expect(
      await File(p.join(localDir.path, outcome.conflictCopies.first)).readAsString(),
      'pad\n',
    );
  });

  test('pull keeps a writer conflict copy beside the original note', () async {
    final remoteDir = await _tempDir('tinynote-git-remote-');
    final remoteNote = p.join(
      remoteDir.path,
      'TinyNote产品管理.tinynotes',
      '公众号管理',
      '公众号注册和定位.writer.md',
    );
    await File(remoteNote).create(recursive: true);
    await File(remoteNote).writeAsString('cloud\n');
    _commitWorkingTree(remoteDir.path, message: 'remote notes');

    final localDir = await _tempDir('tinynote-git-local-');
    final localNote = p.join(
      localDir.path,
      'TinyNote产品管理.tinynotes',
      '公众号管理',
      '公众号注册和定位.writer.md',
    );
    await File(localNote).create(recursive: true);
    await File(localNote).writeAsString('pad\n');
    _commitWorkingTree(localDir.path, message: 'local notes');
    _addFileRemote(localDir.path, remoteDir.path);

    final outcome = await GitSyncService().pull(
      libraryPath: localDir.path,
      config: _fileConfig(remoteDir.path),
      conflictSuffix: '（冲突版本 2026-08-28）',
    );

    expect(await File(localNote).readAsString(), 'cloud\n');
    expect(
      outcome.conflictCopies,
      [
        'TinyNote产品管理.tinynotes/公众号管理/公众号注册和定位（冲突版本 2026-08-28）.writer.md',
      ],
    );
    expect(
      await File(p.join(localDir.path, outcome.conflictCopies.first)).readAsString(),
      'pad\n',
    );
  });
}

Future<Directory> _tempDir([String prefix = 'tinynote-git-']) async {
  final dir = await Directory.systemTemp.createTemp(prefix);
  addTearDown(() async {
    if (await dir.exists()) await dir.delete(recursive: true);
  });
  return dir;
}

GitSyncConfig _fileConfig(String remotePath) {
  return GitSyncConfig(
    connected: true,
    url: Uri.file(remotePath).toString(),
    token: 'unused',
    username: '',
    remoteName: 'origin',
  );
}

void _addFileRemote(String localPath, String remotePath) {
  final repo = Repository.open(localPath);
  try {
    final remote = Remote.create(
      repo: repo,
      name: 'origin',
      url: Uri.file(remotePath).toString(),
    );
    remote.free();
  } finally {
    repo.free();
  }
}

void _commitWorkingTree(String path, {required String message}) {
  final gitDir = Directory(p.join(path, '.git'));
  final repo =
      gitDir.existsSync()
          ? Repository.open(path)
          : Repository.init(path: path, initialHead: 'main');
  try {
    try {
      repo.config['user.name'] = 'TinyNote';
      repo.config['user.email'] = 'tinynote@local';
    } catch (_) {}

    final index = repo.index;
    index.addAll(['.']);
    index.write();
    expect(index.isNotEmpty, isTrue);

    List<Commit> parents = const [];
    try {
      final head = repo.head;
      try {
        final oid = copyGitOid(head.target);
        if (oid != null) {
          parents = [Commit.lookup(repo: repo, oid: oid)];
        }
      } finally {
        head.free();
      }
    } catch (_) {}

    final treeOid = index.writeTree(repo);
    final tree = Tree.lookup(repo: repo, oid: treeOid);
    final signature = Signature.create(
      name: 'TinyNote',
      email: 'tinynote@local',
    );
    try {
      Commit.create(
        repo: repo,
        updateRef: 'HEAD',
        author: signature,
        committer: signature,
        message: message.endsWith('\n') ? message : '$message\n',
        tree: tree,
        parents: parents,
      );
    } finally {
      signature.free();
      tree.free();
      for (final parent in parents) {
        parent.free();
      }
    }
  } finally {
    repo.free();
  }
}
