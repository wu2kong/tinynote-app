import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:git2dart/git2dart.dart';
import 'package:path/path.dart' as p;
import 'package:tinynote_mobile/services/git_sync_config.dart';
import 'package:tinynote_mobile/services/git_sync_service.dart';

void main() {
  test('init, commit, and status work on a local library', () async {
    final dir = await Directory.systemTemp.createTemp('tinynote-git-');
    addTearDown(() async {
      if (await dir.exists()) await dir.delete(recursive: true);
    });

    await File(p.join(dir.path, 'Demo.tinynotes', 'hello.writer.md'))
        .create(recursive: true)
        .then((file) => file.writeAsString('# hello\n'));

    final service = GitSyncService();
    expect(await service.isRepository(dir.path), isFalse);

    final repo = Repository.init(path: dir.path, initialHead: 'main');
    try {
      final index = repo.index;
      index.addAll(['.']);
      index.write();
      expect(index.isNotEmpty, isTrue);

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
          message: 'Initialize TinyNote library\n',
          tree: tree,
          parents: const [],
        );
      } finally {
        signature.free();
        tree.free();
      }
    } finally {
      repo.free();
    }

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
}
