import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:git2dart/git2dart.dart';
import 'package:path/path.dart' as p;

import '../utils/sync_conflict_name.dart';
import 'git_providers.dart';
import 'git_sync_config.dart';

const tinynoteGitignore = '''
.DS_Store
Thumbs.db
desktop.ini
*.swp
*~
.idea/
**/.tinynotes/configs.json
**/.tinynotes/configs.jsonc
''';

class GitSyncException implements Exception {
  GitSyncException(this.message);
  final String message;

  @override
  String toString() => message;
}

class GitPullOutcome {
  const GitPullOutcome({this.conflictCopies = const []});
  final List<String> conflictCopies;
}

class GitPushOutcome {
  const GitPushOutcome({required this.committed, required this.pushed});
  final bool committed;
  final bool pushed;
}

class GitRepoStatus {
  const GitRepoStatus({
    required this.isRepo,
    required this.hasRemote,
    required this.remoteUrl,
    required this.remoteName,
    required this.branch,
    required this.changedCount,
  });

  final bool isRepo;
  final bool hasRemote;
  final String? remoteUrl;
  final String? remoteName;
  final String? branch;
  final int changedCount;
}

class GitSyncService {
  Callbacks _callbacks(GitSyncConfig config) {
    final url = toHttpsRemoteUrl(config.url);
    final auth = authForProvider(
      inferGitProvider(url),
      config.token,
      username: config.username,
    );
    return Callbacks(
      credentials: UserPass(username: auth.username, password: auth.password),
    );
  }

  Future<bool> isRepository(String libraryPath) async {
    return Directory(p.join(libraryPath, '.git')).exists();
  }

  Future<GitRepoStatus> status(String libraryPath, GitSyncConfig config) async {
    if (!await isRepository(libraryPath)) {
      return const GitRepoStatus(
        isRepo: false,
        hasRemote: false,
        remoteUrl: null,
        remoteName: null,
        branch: null,
        changedCount: 0,
      );
    }

    final repo = Repository.open(libraryPath);
    try {
      final remotes = Remote.list(repo);
      final remoteName = _pickRemoteName(remotes, config.remoteName);
      String? remoteUrl;
      if (remoteName != null) {
        final remote = Remote.lookup(repo: repo, name: remoteName);
        remoteUrl = remote.url;
        remote.free();
      }
      String? branch;
      try {
        branch = repo.head.shorthand;
      } catch (_) {
        branch = null;
      }
      final changed = _changedPaths(repo).length;
      return GitRepoStatus(
        isRepo: true,
        hasRemote: remotes.isNotEmpty,
        remoteUrl: remoteUrl,
        remoteName: remoteName,
        branch: branch,
        changedCount: changed,
      );
    } finally {
      repo.free();
    }
  }

  Future<String> connect({
    required String libraryPath,
    required GitSyncConfig config,
  }) async {
    final url = toHttpsRemoteUrl(config.url);
    if (!isHttpsGitUrl(url)) {
      throw GitSyncException('HTTPS URL required');
    }
    if (config.token.trim().isEmpty) {
      throw GitSyncException('token required');
    }

    await Directory(libraryPath).create(recursive: true);
    final created = !await isRepository(libraryPath);
    final repo =
        created
            ? Repository.init(path: libraryPath, initialHead: 'main')
            : Repository.open(libraryPath);
    try {
      await _ensureGitignore(repo);
      _ensureIdentity(repo);
      await _commitIfNeeded(repo, message: 'Initialize TinyNote library');
      final remoteName = _resolveRemoteName(repo, config.remoteName, url);
      _upsertRemote(repo, remoteName, url);

      final liveConfig = config.copyWith(url: url, remoteName: remoteName);
      final callbacks = _callbacks(liveConfig);
      final remote = Remote.lookup(repo: repo, name: remoteName);
      try {
        remote.fetch(callbacks: callbacks);
      } finally {
        remote.free();
      }

      final remoteBranch = _remoteTrackingBranch(repo, remoteName);
      if (remoteBranch == null) {
        await _commitIfNeeded(repo, message: _commitMessage());
        _pushCurrent(repo, liveConfig);
        return remoteName;
      }

      await _mergeRemote(
        repo,
        remoteName: remoteName,
        remoteBranch: remoteBranch,
        conflictSuffix: _defaultConflictSuffix(),
      );
      return remoteName;
    } on GitSyncException {
      rethrow;
    } catch (error) {
      throw GitSyncException(_friendlyError(error));
    } finally {
      repo.free();
    }
  }

  Future<GitPullOutcome> pull({
    required String libraryPath,
    required GitSyncConfig config,
    required String conflictSuffix,
  }) async {
    if (!await isRepository(libraryPath)) {
      throw GitSyncException('not a git repository');
    }
    final repo = Repository.open(libraryPath);
    try {
      final callbacks = _callbacks(config);
      final remote = Remote.lookup(repo: repo, name: config.remoteName);
      try {
        remote.fetch(callbacks: callbacks);
      } finally {
        remote.free();
      }

      final remoteBranch = _remoteTrackingBranch(repo, config.remoteName);
      if (remoteBranch == null) {
        return const GitPullOutcome();
      }
      final copies = await _mergeRemote(
        repo,
        remoteName: config.remoteName,
        remoteBranch: remoteBranch,
        conflictSuffix: conflictSuffix,
      );
      return GitPullOutcome(conflictCopies: copies);
    } on GitSyncException {
      rethrow;
    } catch (error) {
      throw GitSyncException(_friendlyError(error));
    } finally {
      repo.free();
    }
  }

  Future<GitPushOutcome> push({
    required String libraryPath,
    required GitSyncConfig config,
  }) async {
    if (!await isRepository(libraryPath)) {
      throw GitSyncException('not a git repository');
    }
    final repo = Repository.open(libraryPath);
    try {
      await _ensureGitignore(repo);
      final committed = await _commitIfNeeded(repo, message: _commitMessage());
      _pushCurrent(repo, config);
      return GitPushOutcome(committed: committed, pushed: true);
    } on GitSyncException {
      rethrow;
    } catch (error) {
      throw GitSyncException(_friendlyError(error));
    } finally {
      repo.free();
    }
  }

  Future<void> disconnect(String libraryPath, String remoteName) async {
    if (!await isRepository(libraryPath)) return;
    final repo = Repository.open(libraryPath);
    try {
      if (Remote.list(repo).contains(remoteName)) {
        Remote.delete(repo: repo, name: remoteName);
      }
    } catch (error) {
      debugPrint('Failed to remove git remote: $error');
    } finally {
      repo.free();
    }
  }

  Future<String?> readRemoteUrl(String libraryPath, String remoteName) async {
    if (!await isRepository(libraryPath)) return null;
    final repo = Repository.open(libraryPath);
    try {
      final remotes = Remote.list(repo);
      final name = _pickRemoteName(remotes, remoteName);
      if (name == null) return null;
      final remote = Remote.lookup(repo: repo, name: name);
      final url = remote.url;
      remote.free();
      return url;
    } catch (_) {
      return null;
    } finally {
      repo.free();
    }
  }

  String? _pickRemoteName(List<String> remotes, String preferred) {
    if (remotes.isEmpty) return null;
    if (remotes.contains(preferred)) return preferred;
    if (remotes.contains('origin')) return 'origin';
    return remotes.first;
  }

  String _resolveRemoteName(Repository repo, String preferred, String url) {
    final remotes = Remote.list(repo);
    for (final name in remotes) {
      final remote = Remote.lookup(repo: repo, name: name);
      final existing = toHttpsRemoteUrl(remote.url);
      remote.free();
      if (existing == url) return name;
    }
    if (preferred.isNotEmpty && remotes.contains(preferred)) return preferred;
    if (remotes.contains('origin')) return 'origin';
    return preferred.isNotEmpty ? preferred : 'origin';
  }

  void _upsertRemote(Repository repo, String name, String url) {
    final remotes = Remote.list(repo);
    if (remotes.contains(name)) {
      Remote.setUrl(repo: repo, remote: name, url: url);
      return;
    }
    final remote = Remote.create(repo: repo, name: name, url: url);
    remote.free();
  }

  void _ensureIdentity(Repository repo) {
    try {
      repo.config['user.name'] = 'TinyNote';
      repo.config['user.email'] = 'tinynote@local';
    } catch (error) {
      debugPrint('Failed to set git identity: $error');
    }
  }

  Future<void> _ensureGitignore(Repository repo) async {
    final file = File(p.join(repo.workdir, '.gitignore'));
    if (await file.exists()) return;
    await file.writeAsString(tinynoteGitignore);
  }

  Future<bool> _commitIfNeeded(Repository repo, {required String message}) async {
    final index = repo.index;
    index.addAll(['.']);
    index.updateAll(['.']);
    index.write();
    if (index.isEmpty) return false;

    final parents = _headCommit(repo);
    final treeOid = index.writeTree(repo);
    if (parents.isNotEmpty && parents.first.tree.oid.sha == treeOid.sha) {
      return false;
    }

    _createCommit(repo, message: message, parents: parents, treeOid: treeOid);
    return true;
  }

  bool _isUnborn(Repository repo) {
    try {
      return repo.isEmpty || repo.isBranchUnborn;
    } catch (_) {
      return true;
    }
  }

  List<Commit> _headCommit(Repository repo) {
    try {
      if (repo.isEmpty || repo.isBranchUnborn) return const [];
      return [Commit.lookup(repo: repo, oid: repo.head.target)];
    } catch (_) {
      return const [];
    }
  }

  Set<String> _changedPaths(Repository repo) {
    final paths = <String>{};
    try {
      for (final entry in repo.status.entries) {
        final flags = entry.value;
        if (flags.contains(GitStatus.ignored) ||
            flags.contains(GitStatus.current)) {
          continue;
        }
        if (flags.isEmpty) continue;
        paths.add(entry.key);
      }
    } catch (error) {
      debugPrint('Git status listing failed: $error');
    }
    return paths;
  }

  String? _remoteTrackingBranch(Repository repo, String remoteName) {
    final preferred = ['main', 'master'];
    for (final branch in preferred) {
      final name = 'refs/remotes/$remoteName/$branch';
      if (repo.references.contains(name)) return branch;
    }
    for (final name in repo.references) {
      final prefix = 'refs/remotes/$remoteName/';
      if (name.startsWith(prefix) && !name.endsWith('/HEAD')) {
        return name.substring(prefix.length);
      }
    }
    return null;
  }

  Future<List<String>> _mergeRemote(
    Repository repo, {
    required String remoteName,
    required String remoteBranch,
    required String conflictSuffix,
  }) async {
    final refName = 'refs/remotes/$remoteName/$remoteBranch';
    final theirRef = Reference.lookup(repo: repo, name: refName);
    final theirOid = theirRef.target;
    theirRef.free();

    if (_isUnborn(repo)) {
      _checkoutUnborn(repo, theirOid, remoteBranch);
      return const [];
    }

    late final MergeAnalysis analysis;
    try {
      analysis = Merge.analysis(repo: repo, theirHead: theirOid);
    } catch (_) {
      return _mergeUnrelated(
        repo,
        theirOid: theirOid,
        conflictSuffix: conflictSuffix,
      );
    }

    if (analysis.result.contains(GitMergeAnalysis.upToDate) &&
        !analysis.result.contains(GitMergeAnalysis.unborn)) {
      return const [];
    }
    if (analysis.result.contains(GitMergeAnalysis.unborn)) {
      _checkoutUnborn(repo, theirOid, remoteBranch);
      return const [];
    }
    if (analysis.result.contains(GitMergeAnalysis.fastForward) &&
        !analysis.result.contains(GitMergeAnalysis.normal)) {
      repo.reset(oid: theirOid, resetType: GitReset.hard);
      return const [];
    }
    if (analysis.result.contains(GitMergeAnalysis.fastForward)) {
      repo.reset(oid: theirOid, resetType: GitReset.hard);
      return const [];
    }

    final annotated = AnnotatedCommit.lookup(repo: repo, oid: theirOid);
    try {
      Merge.commit(repo: repo, commit: annotated);
    } catch (_) {
      annotated.free();
      return _mergeUnrelated(
        repo,
        theirOid: theirOid,
        conflictSuffix: conflictSuffix,
      );
    }
    annotated.free();

    final copies = await _resolveConflicts(repo, conflictSuffix);
    _commitMerge(repo, theirOid);
    return copies;
  }

  void _checkoutUnborn(Repository repo, Oid oid, String branchName) {
    final commit = Commit.lookup(repo: repo, oid: oid);
    try {
      Checkout.commit(
        repo: repo,
        commit: commit,
        strategy: {GitCheckout.force, GitCheckout.recreateMissing},
      );
      if (!repo.references.contains('refs/heads/$branchName')) {
        Branch.create(repo: repo, name: branchName, target: commit);
      }
      repo.setHead('refs/heads/$branchName');
    } finally {
      commit.free();
    }
  }

  Future<List<String>> _mergeUnrelated(
    Repository repo, {
    required Oid theirOid,
    required String conflictSuffix,
  }) async {
    final ourCommit = Commit.lookup(repo: repo, oid: repo.head.target);
    final theirCommit = Commit.lookup(repo: repo, oid: theirOid);
    try {
      final ourFiles = <String, Oid>{};
      final theirFiles = <String, Oid>{};
      _collectTreeFiles(repo, ourCommit.tree, '', ourFiles);
      _collectTreeFiles(repo, theirCommit.tree, '', theirFiles);

      final copies = <String>[];
      final allPaths = {...ourFiles.keys, ...theirFiles.keys};
      for (final path in allPaths) {
        final ours = ourFiles[path];
        final theirs = theirFiles[path];
        if (ours != null && theirs != null && ours.sha != theirs.sha) {
          await _writeBlob(repo, ours, path);
          final copy = await _writeConflictCopy(
            repo,
            relativePath: path,
            oid: ours,
            suffix: conflictSuffix,
          );
          copies.add(copy);
          await _writeBlob(repo, theirs, path);
        } else if (theirs != null && ours == null) {
          await _writeBlob(repo, theirs, path);
        }
      }

      final index = repo.index;
      index.addAll(['.']);
      index.updateAll(['.']);
      index.write();
      _createCommit(
        repo,
        message: 'Merge remote-tracking branch',
        parents: [ourCommit, theirCommit],
      );
      return copies;
    } finally {
      ourCommit.free();
      theirCommit.free();
    }
  }

  Future<List<String>> _resolveConflicts(Repository repo, String suffix) async {
    final index = repo.index;
    if (!index.hasConflicts) {
      Checkout.index(repo: repo);
      return const [];
    }

    final copies = <String>[];
    final conflicts = Map<String, ConflictEntry>.from(index.conflicts);
    for (final entry in conflicts.entries) {
      final path = entry.key;
      final conflict = entry.value;
      final our = conflict.our;
      final their = conflict.their;
      if (our != null) {
        final copy = await _writeConflictCopy(
          repo,
          relativePath: path,
          oid: our.oid,
          suffix: suffix,
        );
        copies.add(copy);
      }
      conflict.remove();
      if (their != null) {
        await _writeBlob(repo, their.oid, path);
        index.add(path);
      } else {
        final file = File(p.join(repo.workdir, path));
        if (await file.exists()) await file.delete();
        if (index.find(path)) index.remove(path);
      }
    }

    for (final copy in copies) {
      index.add(copy);
    }
    index.write();
    Checkout.index(repo: repo);
    return copies;
  }

  void _commitMerge(Repository repo, Oid theirOid) {
    final our = _headCommit(repo);
    final their = Commit.lookup(repo: repo, oid: theirOid);
    try {
      _createCommit(
        repo,
        message: 'Merge remote-tracking branch',
        parents: [...our, their],
      );
      repo.stateCleanup();
    } finally {
      their.free();
    }
  }

  void _createCommit(
    Repository repo, {
    required String message,
    required List<Commit> parents,
    Oid? treeOid,
  }) {
    final index = repo.index;
    index.write();
    final oid = treeOid ?? index.writeTree(repo);
    final tree = Tree.lookup(repo: repo, oid: oid);
    final signature = Signature.create(
      name: _hostname(),
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
    }
  }

  void _pushCurrent(Repository repo, GitSyncConfig config) {
    String branch;
    try {
      branch = repo.head.shorthand;
    } catch (_) {
      branch = 'main';
    }
    final remote = Remote.lookup(repo: repo, name: config.remoteName);
    try {
      remote.push(
        refspecs: ['refs/heads/$branch:refs/heads/$branch'],
        callbacks: _callbacks(config),
      );
    } finally {
      remote.free();
    }
  }

  void _collectTreeFiles(
    Repository repo,
    Tree tree,
    String prefix,
    Map<String, Oid> out,
  ) {
    for (final entry in tree.entries) {
      final path = prefix.isEmpty ? entry.name : '$prefix/${entry.name}';
      if (entry.filemode == GitFilemode.tree || entry.type == GitObject.tree) {
        final subtree = Tree.lookup(repo: repo, oid: entry.oid);
        try {
          _collectTreeFiles(repo, subtree, path, out);
        } finally {
          subtree.free();
        }
      } else {
        out[path] = entry.oid;
      }
    }
  }

  Future<void> _writeBlob(Repository repo, Oid oid, String relativePath) async {
    final blob = Blob.lookup(repo: repo, oid: oid);
    try {
      final file = File(p.join(repo.workdir, relativePath));
      await file.parent.create(recursive: true);
      await file.writeAsBytes(blob.contentBytes, flush: true);
    } finally {
      blob.free();
    }
  }

  Future<String> _writeConflictCopy(
    Repository repo, {
    required String relativePath,
    required Oid oid,
    required String suffix,
  }) async {
    final copy = await allocateConflictCopyPath(
      relativePath: relativePath,
      suffix: suffix,
      exists: (path) async => File(p.join(repo.workdir, path)).exists(),
    );
    await _writeBlob(repo, oid, copy);
    return copy;
  }

  String _commitMessage() => '${_hostname()} sync push';

  String _defaultConflictSuffix() {
    return '（冲突版本 ${formatLocalIsoDate()}）';
  }

  String _hostname() {
    try {
      final name = Platform.localHostname.trim();
      if (name.isNotEmpty) return name;
    } catch (_) {}
    return 'TinyNote Mobile';
  }

  String _friendlyError(Object error) {
    final text = error.toString();
    final lower = text.toLowerCase();
    if (lower.contains('auth') ||
        lower.contains('401') ||
        lower.contains('403') ||
        lower.contains('credential') ||
        lower.contains('unauthorized')) {
      return 'auth';
    }
    return text;
  }
}
