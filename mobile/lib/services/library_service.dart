import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/file_system.dart';
import '../core/global_search.dart';
import '../core/import_notes.dart';
import '../core/note_parser.dart';
import '../core/official_sample_library.dart';
import '../core/path_utils.dart';
import '../core/types.dart';
import '../l10n/l10n.dart';
import '../storage/local_storage.dart';
import '../utils/sync_conflict_name.dart';
import 'git_providers.dart';
import 'git_sync_config.dart';
import 'git_sync_service.dart';
import 'icloud_service.dart';

class LibraryService extends ChangeNotifier {
  bool ready = false;
  bool loading = true;
  String? storagePath;
  String? errorMessage;
  List<Space> spaces = const [];

  Space? currentSpace;
  Notebook? currentNotebook;
  bool notebookLoading = false;
  final Set<String> expandedGroupPaths = <String>{};

  bool iCloudEnabled = false;
  bool iCloudAvailable = false;
  bool iCloudSupported = ICloudService.isSupported;
  bool syncBusy = false;
  String? syncMessage;

  GitSyncConfig gitConfig = GitSyncConfig.empty;
  GitRepoStatus gitStatus = const GitRepoStatus(
    isRepo: false,
    hasRemote: false,
    remoteUrl: null,
    remoteName: null,
    branch: null,
    changedCount: 0,
  );

  LocalStorage? _storage;
  FileSystemService? _fileSystem;
  final _gitConfigStore = GitSyncConfigStore();
  final _gitSync = GitSyncService();

  static const _storagePathKey = 'tinynote.storagePath';
  static const _currentSpaceIdKey = 'tinynote.currentSpaceId';
  static const _iCloudEnabledKey = 'tinynote.iCloudEnabled';

  Future<void> bootstrap() async {
    loading = true;
    errorMessage = null;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      iCloudEnabled = prefs.getBool(_iCloudEnabledKey) ?? false;
      iCloudAvailable = await ICloudService.isAvailable();

      String? externalLibraryPath;
      if (iCloudEnabled) {
        externalLibraryPath = await ICloudService.restoreLibraryAccess();
        if (externalLibraryPath == null || externalLibraryPath.isEmpty) {
          debugPrint('Bookmarked library unavailable, falling back to local');
          iCloudEnabled = false;
          await prefs.setBool(_iCloudEnabledKey, false);
          await ICloudService.clearLibraryBookmark();
          syncMessage = appStrings.bookmarkUnavailableLocal;
        } else {
          externalLibraryPath = await resolveExternalLibraryRoot(
            externalLibraryPath,
          );
        }
      }

      final savedPath = prefs.getString(_storagePathKey);
      final rootPath = await LocalStorage.resolveRootPath(
        savedPath,
        externalEnabled: iCloudEnabled,
        externalLibraryPath: externalLibraryPath,
      );

      if (savedPath != null && savedPath != rootPath) {
        await prefs.remove(_storagePathKey);
      }

      _storage = LocalStorage(rootPath);
      await _storage!.ensureRoot();
      _fileSystem = FileSystemService(_storage!);

      await _fileSystem!.ensureSampleLibrary(rootPath);
      storagePath = rootPath;
      await prefs.setString(_storagePathKey, rootPath);

      spaces = await _fileSystem!.loadSpaces(rootPath);
      await _restoreSelection(prefs);
      await _loadGitState(rootPath);
      ready = true;
    } catch (error, stackTrace) {
      debugPrint('Library bootstrap failed: $error\n$stackTrace');
      errorMessage = appStrings.fill(appStrings.libraryInitFailed, {
        'error': '$error',
      });
      ready = false;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshICloudStatus() async {
    iCloudAvailable = await ICloudService.isAvailable();
    notifyListeners();
  }

  bool get gitConnected => gitConfig.connected;

  Future<void> refreshGitStatus() async {
    final root = storagePath;
    if (root == null) return;
    await _loadGitState(root);
    notifyListeners();
  }

  Future<void> connectGit({
    required String url,
    required String token,
    String username = '',
  }) async {
    final root = storagePath;
    if (root == null) throw StateError(appStrings.gitSyncNotReady);
    if (syncBusy) return;

    final httpsUrl = toHttpsRemoteUrl(url);
    if (!isHttpsGitUrl(httpsUrl)) {
      throw StateError(appStrings.gitSyncUrlRequired);
    }
    if (token.trim().isEmpty) {
      throw StateError(appStrings.gitSyncTokenRequired);
    }

    syncBusy = true;
    syncMessage = appStrings.gitSyncConnecting;
    notifyListeners();

    try {
      final next = gitConfig.copyWith(
        connected: true,
        url: httpsUrl,
        token: token.trim(),
        username: username.trim(),
        remoteName: gitConfig.remoteName.isEmpty ? 'origin' : gitConfig.remoteName,
      );
      final remoteName = await _gitSync.connect(libraryPath: root, config: next);
      final saved = next.copyWith(remoteName: remoteName);
      await _gitConfigStore.save(saved);
      gitConfig = saved;
      await _openRoot(root, prefs: await SharedPreferences.getInstance());
      await _loadGitState(root);
      syncMessage = appStrings.gitSyncConnected;
    } catch (error) {
      syncMessage = _gitErrorMessage(error, fallback: appStrings.gitSyncConnectFailed);
      rethrow;
    } finally {
      syncBusy = false;
      notifyListeners();
    }
  }

  Future<void> disconnectGit() async {
    final root = storagePath;
    if (root == null) throw StateError(appStrings.gitSyncNotReady);
    if (syncBusy) return;

    syncBusy = true;
    syncMessage = null;
    notifyListeners();

    try {
      await _gitSync.disconnect(root, gitConfig.remoteName);
      await _gitConfigStore.clear();
      gitConfig = GitSyncConfig.empty;
      await _loadGitState(root);
      syncMessage = appStrings.gitSyncDisconnected;
    } catch (error) {
      syncMessage = '$error';
      rethrow;
    } finally {
      syncBusy = false;
      notifyListeners();
    }
  }

  Future<List<String>> pullGit() async {
    final root = storagePath;
    if (root == null) throw StateError(appStrings.gitSyncNotReady);
    if (!gitConfig.connected) throw StateError(appStrings.gitSyncConnectFailed);
    if (syncBusy) return const [];

    syncBusy = true;
    syncMessage = appStrings.gitSyncPulling;
    notifyListeners();

    try {
      final suffix = appStrings.fill(appStrings.gitSyncConflictCopySuffix, {
        'date': formatLocalIsoDate(),
      });
      final result = await _gitSync.pull(
        libraryPath: root,
        config: gitConfig,
        conflictSuffix: suffix,
      );
      await _openRoot(root, prefs: await SharedPreferences.getInstance());
      await _loadGitState(root);
      syncMessage =
          result.conflictCopies.isEmpty
              ? appStrings.gitSyncPullComplete
              : appStrings.fill(appStrings.gitSyncPullCompleteWithConflicts, {
                'files': result.conflictCopies.join(', '),
              });
      return result.conflictCopies;
    } catch (error) {
      syncMessage = _gitErrorMessage(error, fallback: appStrings.gitSyncPullFailed);
      rethrow;
    } finally {
      syncBusy = false;
      notifyListeners();
    }
  }

  Future<void> pushGit() async {
    final root = storagePath;
    if (root == null) throw StateError(appStrings.gitSyncNotReady);
    if (!gitConfig.connected) throw StateError(appStrings.gitSyncConnectFailed);
    if (syncBusy) return;

    syncBusy = true;
    syncMessage = appStrings.gitSyncPushing;
    notifyListeners();

    try {
      final result = await _gitSync.push(libraryPath: root, config: gitConfig);
      await _loadGitState(root);
      syncMessage =
          result.committed || result.pushed
              ? appStrings.gitSyncPushed
              : appStrings.gitSyncNoChanges;
    } catch (error) {
      syncMessage = _gitErrorMessage(error, fallback: appStrings.gitSyncPushFailed);
      rethrow;
    } finally {
      syncBusy = false;
      notifyListeners();
    }
  }

  /// Enable sync by letting the user pick an iCloud Drive / Files folder.
  Future<void> enableICloudSync() async {
    if (!iCloudSupported) {
      throw StateError(appStrings.syncUnsupported);
    }
    if (syncBusy) return;

    syncBusy = true;
    syncMessage = appStrings.selectICloudFolder;
    notifyListeners();

    try {
      final picked = await ICloudService.pickLibraryFolder();
      if (picked == null || picked.isEmpty) {
        syncMessage = null;
        return;
      }

      final localRoot = await LocalStorage.defaultRootPath();
      final externalRoot = await resolveExternalLibraryRoot(picked);
      final externalStorage = LocalStorage(externalRoot);
      await externalStorage.ensureRoot();

      final cloudEmpty = await externalStorage.isEmptyLibrary();
      final localStorage = LocalStorage(localRoot);
      final localEmpty = await localStorage.isEmptyLibrary();

      if (cloudEmpty && !localEmpty) {
        syncMessage = appStrings.copyingLocalNotes;
        notifyListeners();
        await externalStorage.copyLibraryFrom(localRoot);
      } else if (!cloudEmpty && !localEmpty && localRoot != externalRoot) {
        syncMessage = appStrings.usingSelectedLibrary;
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_iCloudEnabledKey, true);
      await prefs.setString(_storagePathKey, externalRoot);
      iCloudEnabled = true;

      await _openRoot(externalRoot, prefs: prefs);
      syncMessage ??= appStrings.syncEnabled;
    } catch (error) {
      syncMessage = '$error';
      rethrow;
    } finally {
      syncBusy = false;
      notifyListeners();
    }
  }

  /// Re-pick the sync folder while keeping sync enabled.
  Future<void> changeICloudFolder() async {
    if (!iCloudEnabled) {
      await enableICloudSync();
      return;
    }
    if (syncBusy) return;

    syncBusy = true;
    syncMessage = appStrings.reselectSyncFolder;
    notifyListeners();

    try {
      final picked = await ICloudService.pickLibraryFolder();
      if (picked == null || picked.isEmpty) {
        syncMessage = null;
        return;
      }

      final externalRoot = await resolveExternalLibraryRoot(picked);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storagePathKey, externalRoot);
      await _openRoot(externalRoot, prefs: prefs);
      syncMessage = appStrings.syncFolderChanged;
    } catch (error) {
      syncMessage = '$error';
      rethrow;
    } finally {
      syncBusy = false;
      notifyListeners();
    }
  }

  /// Disable sync and switch back to the on-device library.
  Future<void> disableICloudSync({bool copyFromCloud = true}) async {
    if (syncBusy) return;

    syncBusy = true;
    syncMessage = null;
    notifyListeners();

    try {
      final localRoot = await LocalStorage.defaultRootPath();
      final localStorage = LocalStorage(localRoot);
      await localStorage.ensureRoot();

      final current = storagePath;
      if (copyFromCloud &&
          current != null &&
          current != localRoot &&
          await localStorage.isEmptyLibrary()) {
        syncMessage = appStrings.copyingCloudNotes;
        notifyListeners();
        await localStorage.copyLibraryFrom(current);
      }

      await ICloudService.clearLibraryBookmark();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_iCloudEnabledKey, false);
      await prefs.setString(_storagePathKey, localRoot);
      iCloudEnabled = false;

      await _openRoot(localRoot, prefs: prefs);
      syncMessage = appStrings.syncDisabledLocal;
    } catch (error) {
      syncMessage = '$error';
      rethrow;
    } finally {
      syncBusy = false;
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    if (_fileSystem == null || storagePath == null) return;
    loading = true;
    errorMessage = null;
    notifyListeners();
    try {
      if (iCloudEnabled) {
        final restored = await ICloudService.restoreLibraryAccess();
        if (restored == null) {
          syncMessage = appStrings.syncFolderUnavailable;
        }
      }
      await _reloadTree(
        preserveNotebookPath: currentNotebook?.path,
        preserveExpanded: true,
      );
    } catch (error) {
      errorMessage = appStrings.fill(appStrings.refreshFailed, {
        'error': '$error',
      });
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> resetAndRetry() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storagePathKey);
    await prefs.remove(_currentSpaceIdKey);
    ready = false;
    currentSpace = null;
    currentNotebook = null;
    expandedGroupPaths.clear();
    await bootstrap();
  }

  Future<void> selectSpace(Space space) async {
    if (currentSpace?.id == space.id) return;
    currentSpace = space;
    currentNotebook = null;
    expandedGroupPaths.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_currentSpaceIdKey, space.id);
    notifyListeners();
  }

  Future<void> createSpace(String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) throw StateError(appStrings.nameRequired);
    final root = storagePath;
    if (root == null || _fileSystem == null) {
      throw StateError(appStrings.libraryNotReady);
    }
    final created = await _fileSystem!.createSpace(root, trimmed);
    await _reloadTree(preserveExpanded: false);
    final matched = spaces.where((space) => space.id == created.id);
    await selectSpace(matched.isNotEmpty ? matched.first : created);
  }

  Future<void> renameSpace(Space space, String newName) async {
    final trimmed = newName.trim();
    if (trimmed.isEmpty) throw StateError(appStrings.nameRequired);
    if (trimmed == space.name) return;

    final oldPath = space.path;
    final newPath = await _fileSystem!.renameSpace(oldPath, trimmed);

    final remapped =
        expandedGroupPaths.map((path) {
          if (path == oldPath || path.startsWith('$oldPath/')) {
            return '$newPath${path.substring(oldPath.length)}';
          }
          return path;
        }).toSet();
    expandedGroupPaths
      ..clear()
      ..addAll(remapped);

    String? notebookPath = currentNotebook?.path;
    if (notebookPath != null &&
        (notebookPath == oldPath || notebookPath.startsWith('$oldPath/'))) {
      notebookPath = '$newPath${notebookPath.substring(oldPath.length)}';
    }

    final restoreSpacePath =
        currentSpace?.path == oldPath ? newPath : currentSpace?.path;

    spaces = await _fileSystem!.loadSpaces(storagePath!);
    currentSpace =
        _findSpaceByPath(restoreSpacePath) ??
        (spaces.isNotEmpty ? spaces.first : null);

    if (currentSpace != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_currentSpaceIdKey, currentSpace!.id);
    }

    if (notebookPath != null) {
      final notebook = _findNotebook(notebookPath);
      if (notebook != null) {
        final fresh = await _fileSystem!.loadNotebook(notebook.path);
        currentNotebook = fresh ?? notebook;
      } else {
        currentNotebook = null;
      }
    }

    notifyListeners();
  }

  Future<void> deleteSpace(Space space) async {
    final wasCurrent = currentSpace?.path == space.path;
    await _fileSystem!.deleteSpace(space.path);

    expandedGroupPaths.removeWhere(
      (path) => path == space.path || path.startsWith('${space.path}/'),
    );

    spaces = await _fileSystem!.loadSpaces(storagePath!);

    if (wasCurrent) {
      currentNotebook = null;
      if (spaces.isNotEmpty) {
        await selectSpace(spaces.first);
      } else {
        currentSpace = null;
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_currentSpaceIdKey);
        notifyListeners();
      }
      return;
    }

    notifyListeners();
  }

  Space? _findSpaceByPath(String? path) {
    if (path == null) return null;
    for (final space in spaces) {
      if (space.path == path) return space;
    }
    return null;
  }

  Future<void> selectNotebook(Notebook notebook) async {
    final keepCompat =
        currentNotebook?.path == notebook.path &&
        (currentNotebook?.compatOpenAsMarkdown ?? false);
    currentNotebook = notebook;
    notebookLoading = true;
    notifyListeners();

    try {
      final fresh = await _fileSystem?.loadNotebook(notebook.path);
      if (fresh != null) {
        currentNotebook =
            keepCompat ? fresh.copyWith(compatOpenAsMarkdown: true) : fresh;
      }
    } finally {
      notebookLoading = false;
      notifyListeners();
    }
  }

  void openUnsupportedAsMarkdown() {
    final notebook = currentNotebook;
    if (notebook == null || !notebook.format.isUnsupported) return;
    currentNotebook = notebook.copyWith(compatOpenAsMarkdown: true);
    notifyListeners();
  }

  /// Navigate to a global search hit: switch space, expand ancestors, open notebook.
  Future<NoteBlock?> navigateToGlobalSearchResult(
    GlobalSearchResult result,
  ) async {
    Space? space;
    for (final item in spaces) {
      if (normalizePath(item.path) == normalizePath(result.spacePath)) {
        space = item;
        break;
      }
    }
    if (space == null) return null;

    final needsSpaceSwitch =
        currentSpace == null ||
        normalizePath(currentSpace!.path) != normalizePath(result.spacePath);
    if (needsSpaceSwitch) {
      await selectSpace(space);
    }

    if (result.type == GlobalSearchResultType.space) return null;

    final notebookPath = result.notebookPath;
    final spaceNow = currentSpace;
    if (notebookPath == null || spaceNow == null) return null;

    final notebookInTree = _findNotebookInItems(spaceNow.groups, notebookPath);
    if (notebookInTree == null) return null;

    for (final path in _ancestorPaths(spaceNow.groups, notebookPath)) {
      expandedGroupPaths.add(path);
    }

    await selectNotebook(notebookInTree);

    if (result.type != GlobalSearchResultType.noteBlock ||
        result.blockTitleKey == null) {
      return null;
    }

    final loaded = currentNotebook;
    if (loaded == null || loaded.format.isDocument) return null;
    for (final block in loaded.noteBlocks) {
      if (block.title == result.blockTitleKey) return block;
    }
    return null;
  }

  void toggleExpandedGroup(String path) {
    if (expandedGroupPaths.contains(path)) {
      expandedGroupPaths.remove(path);
    } else {
      expandedGroupPaths.add(path);
    }
    notifyListeners();
  }

  bool isGroupExpanded(String path) => expandedGroupPaths.contains(path);

  Future<void> createGroup(String parentPath, String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) throw StateError(appStrings.nameRequired);
    await _fileSystem!.createGroup(parentPath, trimmed);
    expandedGroupPaths.add(parentPath);
    await _reloadTree(
      preserveNotebookPath: currentNotebook?.path,
      preserveExpanded: true,
    );
  }

  Future<void> createNotebook(
    String parentPath,
    String name, {
    NotebookFormat format = NotebookFormat.blocks,
  }) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) throw StateError(appStrings.nameRequired);
    try {
      final notebook = await _fileSystem!.createNotebook(
        parentPath,
        trimmed,
        format: format,
      );
      expandedGroupPaths.add(parentPath);
      await _reloadTree(
        preserveNotebookPath: notebook.path,
        preserveExpanded: true,
      );
      await selectNotebook(notebook);
    } on NotebookExistsException catch (error) {
      throw StateError(
        appStrings.fill(appStrings.notebookExists, {'name': error.name}),
      );
    }
  }

  Future<ImportNotesResult> importNotesToCurrentSpace(
    List<ImportNoteSource> sources,
  ) async {
    final storage = _storage;
    final space = currentSpace;
    if (storage == null || space == null) {
      throw StateError(appStrings.importNotesNoSpace);
    }
    final result = await importNotesToSpaceRoot(
      storage: storage,
      spacePath: space.path,
      sources: sources,
    );
    await _reloadTree(
      preserveNotebookPath: currentNotebook?.path,
      preserveExpanded: true,
    );
    return result;
  }

  Future<OfficialSampleLibraryImportResult> importOfficialSampleLibrary(
    AppLocale locale,
  ) async {
    final storage = _storage;
    final root = storagePath;
    if (storage == null || root == null) {
      throw StateError(appStrings.libraryNotReady);
    }
    final result = await importOfficialSampleLibraryToStorage(
      storage: storage,
      storagePath: root,
      locale: locale,
    );
    await _reloadTree(preserveExpanded: false);
    final space = _findSpaceByPath(result.spacePath);
    if (space != null) {
      await selectSpace(space);
      for (final path in _ancestorPaths(
        space.groups,
        result.welcomeNotebookPath,
      )) {
        expandedGroupPaths.add(path);
      }
      notifyListeners();
      final notebook = _findNotebook(result.welcomeNotebookPath);
      if (notebook != null) {
        await selectNotebook(notebook);
      }
    }
    return result;
  }

  Future<void> renameGroup(Group group, String newName) async {
    final trimmed = newName.trim();
    if (trimmed.isEmpty) throw StateError(appStrings.nameRequired);
    final oldPath = group.path;
    final newPath = await _fileSystem!.renameGroup(oldPath, trimmed);
    final remapped =
        expandedGroupPaths.map((path) {
          if (path == oldPath || path.startsWith('$oldPath/')) {
            return '$newPath${path.substring(oldPath.length)}';
          }
          return path;
        }).toSet();
    expandedGroupPaths
      ..clear()
      ..addAll(remapped);

    String? notebookPath = currentNotebook?.path;
    if (notebookPath != null &&
        (notebookPath == oldPath || notebookPath.startsWith('$oldPath/'))) {
      notebookPath = '$newPath${notebookPath.substring(oldPath.length)}';
    }
    await _reloadTree(
      preserveNotebookPath: notebookPath,
      preserveExpanded: true,
    );
  }

  Future<void> renameNotebook(Notebook notebook, String newName) async {
    final trimmed = newName.trim();
    if (trimmed.isEmpty) throw StateError(appStrings.nameRequired);
    final wasSelected = currentNotebook?.path == notebook.path;
    try {
      final newPath = await _fileSystem!.renameNotebook(notebook.path, trimmed);
      await _reloadTree(
        preserveNotebookPath: wasSelected ? newPath : currentNotebook?.path,
        preserveExpanded: true,
      );
    } on NotebookExistsException catch (error) {
      throw StateError(
        appStrings.fill(appStrings.notebookExists, {'name': error.name}),
      );
    }
  }

  Future<void> convertNotebookFormat(
    Notebook notebook,
    NotebookFormat targetFormat,
  ) async {
    if (notebook.format == targetFormat) return;
    if (notebook.format.swappableArticleFormat != targetFormat) {
      throw StateError(appStrings.convertFormatFailed);
    }
    final wasSelected = currentNotebook?.path == notebook.path;
    try {
      final newPath = await _fileSystem!.convertNotebookFormat(
        notebook.path,
        targetFormat,
      );
      await _reloadTree(
        preserveNotebookPath: wasSelected ? newPath : currentNotebook?.path,
        preserveExpanded: true,
      );
    } on NotebookExistsException {
      throw StateError(appStrings.convertFormatExists);
    } on NotebookFormatNotSwappableException {
      throw StateError(appStrings.convertFormatFailed);
    }
  }

  Future<void> deleteGroup(Group group) async {
    final groupPath = group.path;
    await _fileSystem!.deleteGroup(groupPath);

    expandedGroupPaths.removeWhere(
      (path) => path == groupPath || path.startsWith('$groupPath/'),
    );

    await _reloadTree(
      preserveNotebookPath: currentNotebook?.path,
      preserveExpanded: true,
    );
  }

  Future<void> deleteNotebook(Notebook notebook) async {
    await _fileSystem!.deleteNotebook(notebook.path);
    await _reloadTree(
      preserveNotebookPath: currentNotebook?.path,
      preserveExpanded: true,
    );
  }

  Future<NoteBlock> addNoteBlock({
    NoteBlock? existing,
    ContentType contentType = ContentType.text,
    String? title,
    String? content,
    List<String>? tags,
  }) async {
    final notebook = currentNotebook;
    if (notebook == null) throw StateError(appStrings.noNotebookSelected);
    if (notebook.format != NotebookFormat.blocks) {
      throw StateError(appStrings.documentBlocksUnsupported);
    }
    final now = DateTime.now().toUtc().toIso8601String();
    final block =
        existing != null
            ? NoteBlock(
              id: existing.id,
              title: title ?? existing.title,
              content: content ?? existing.content,
              contentType: contentType,
              tags: tags ?? existing.tags,
              createdAt: existing.createdAt,
              updatedAt: now,
            )
            : createNoteBlock(
              contentType: contentType,
              title: title,
              content: content,
              tags: tags,
            );
    final updated = Notebook(
      id: notebook.id,
      name: notebook.name,
      path: notebook.path,
      format: notebook.format,
      content: notebook.content,
      noteBlocks: [...notebook.noteBlocks, block],
    );
    await _fileSystem!.saveNotebook(updated);
    currentNotebook = updated;
    notifyListeners();
    return block;
  }

  Future<void> updateNoteBlock(
    String id, {
    String? title,
    String? content,
    ContentType? contentType,
    List<String>? tags,
  }) async {
    final notebook = currentNotebook;
    if (notebook == null) throw StateError(appStrings.noNotebookSelected);
    final now = DateTime.now().toUtc().toIso8601String();
    final updatedBlocks =
        notebook.noteBlocks.map((block) {
          if (block.id != id) return block;
          return NoteBlock(
            id: block.id,
            title: title ?? block.title,
            content: content ?? block.content,
            contentType: contentType ?? block.contentType,
            tags: tags ?? block.tags,
            createdAt: block.createdAt,
            updatedAt: now,
          );
        }).toList();
    final updated = Notebook(
      id: notebook.id,
      name: notebook.name,
      path: notebook.path,
      format: notebook.format,
      content: notebook.format.isDocument
          ? (updatedBlocks.isNotEmpty
              ? updatedBlocks.first.content
              : notebook.content)
          : notebook.content,
      noteBlocks: updatedBlocks,
    );
    await _fileSystem!.saveNotebook(updated);
    currentNotebook = updated;
    notifyListeners();
  }

  Future<void> deleteNoteBlock(String id) async {
    final notebook = currentNotebook;
    if (notebook == null) throw StateError(appStrings.noNotebookSelected);
    if (notebook.format != NotebookFormat.blocks) {
      throw StateError(appStrings.documentBlocksUnsupported);
    }
    final updated = Notebook(
      id: notebook.id,
      name: notebook.name,
      path: notebook.path,
      format: notebook.format,
      content: notebook.content,
      noteBlocks: notebook.noteBlocks.where((b) => b.id != id).toList(),
    );
    await _fileSystem!.saveNotebook(updated);
    currentNotebook = updated;
    notifyListeners();
  }

  Future<void> updateNotebookContent(String content) async {
    final notebook = currentNotebook;
    if (notebook == null) throw StateError(appStrings.noNotebookSelected);
    if (!notebook.format.isDocument && !notebook.compatOpenAsMarkdown) {
      throw StateError(appStrings.documentBlocksUnsupported);
    }
    final now = DateTime.now().toUtc().toIso8601String();
    final updated = notebook.copyWith(
      content: content,
      noteBlocks: [
        NoteBlock(
          id: notebook.id,
          title: notebook.name,
          content: content,
          contentType: ContentType.markdown,
          tags: const [],
          createdAt:
              notebook.noteBlocks.isNotEmpty
                  ? notebook.noteBlocks.first.createdAt
                  : now,
          updatedAt: now,
        ),
      ],
    );
    await _fileSystem!.saveNotebook(updated);
    currentNotebook = updated;
    notifyListeners();
  }

  Future<List<LibraryItem>> loadFolderChildren(String folderPath) {
    return _fileSystem!.loadFolderChildren(folderPath);
  }

  Future<Notebook?> loadNotebook(String path) {
    return _fileSystem!.loadNotebook(path);
  }

  Future<void> _openRoot(
    String rootPath, {
    required SharedPreferences prefs,
  }) async {
    loading = true;
    notifyListeners();

    _storage = LocalStorage(rootPath);
    await _storage!.ensureRoot();
    _fileSystem = FileSystemService(_storage!);
    await _fileSystem!.ensureSampleLibrary(rootPath);
    storagePath = rootPath;
    await prefs.setString(_storagePathKey, rootPath);

    spaces = await _fileSystem!.loadSpaces(rootPath);
    await _restoreSelection(prefs);
    await _loadGitState(rootPath);
    ready = true;
    loading = false;
  }

  Future<void> _reloadTree({
    String? preserveNotebookPath,
    bool preserveExpanded = false,
  }) async {
    final previousSpaceId = currentSpace?.id;
    final previousExpanded =
        preserveExpanded ? Set<String>.from(expandedGroupPaths) : <String>{};

    spaces = await _fileSystem!.loadSpaces(storagePath!);
    _restoreSpace(previousSpaceId);

    if (preserveExpanded) {
      expandedGroupPaths
        ..clear()
        ..addAll(previousExpanded.where(_pathExistsInCurrentSpace));
    }

    if (preserveNotebookPath != null) {
      final notebook = _findNotebook(preserveNotebookPath);
      if (notebook != null) {
        final fresh = await _fileSystem!.loadNotebook(notebook.path);
        currentNotebook = fresh ?? notebook;
      } else {
        currentNotebook = null;
      }
    } else if (currentNotebook != null) {
      final stillThere = _findNotebook(currentNotebook!.path);
      if (stillThere == null) currentNotebook = null;
    }

    notifyListeners();
  }

  Future<void> _restoreSelection(SharedPreferences prefs) async {
    final savedSpaceId = prefs.getString(_currentSpaceIdKey);
    _restoreSpace(savedSpaceId);
    if (currentSpace != null) {
      await prefs.setString(_currentSpaceIdKey, currentSpace!.id);
    }
  }

  void _restoreSpace(String? spaceId) {
    if (spaces.isEmpty) {
      currentSpace = null;
      currentNotebook = null;
      return;
    }

    Space? matched;
    if (spaceId != null) {
      for (final space in spaces) {
        if (space.id == spaceId) {
          matched = space;
          break;
        }
      }
    }
    currentSpace = matched ?? spaces.first;
  }

  bool _pathExistsInCurrentSpace(String path) {
    final space = currentSpace;
    if (space == null) return false;
    if (space.path == path) return true;
    return _containsPath(space.groups, path);
  }

  bool _containsPath(List<LibraryItem> items, String path) {
    for (final item in items) {
      if (item is GroupItem) {
        if (item.group.path == path) return true;
        if (_containsPath(item.group.children, path)) return true;
      } else if (item is NotebookItem) {
        if (item.notebook.path == path) return true;
      }
    }
    return false;
  }

  Notebook? _findNotebook(String path) {
    final space = currentSpace;
    if (space == null) return null;
    return _findNotebookInItems(space.groups, path);
  }

  Notebook? _findNotebookInItems(List<LibraryItem> items, String path) {
    final target = normalizePath(path);
    for (final item in items) {
      if (item is NotebookItem && normalizePath(item.notebook.path) == target) {
        return item.notebook;
      }
      if (item is GroupItem) {
        final found = _findNotebookInItems(item.group.children, path);
        if (found != null) return found;
      }
    }
    return null;
  }

  List<String> _ancestorPaths(List<LibraryItem> items, String targetPath) {
    final normalizedTarget = normalizePath(targetPath);
    final ancestors = <String>[];

    bool search(List<LibraryItem> list) {
      for (final item in list) {
        if (item is NotebookItem &&
            normalizePath(item.notebook.path) == normalizedTarget) {
          return true;
        }
        if (item is GroupItem) {
          if (normalizePath(item.group.path) == normalizedTarget) {
            return true;
          }
          if (search(item.group.children)) {
            ancestors.add(item.group.path);
            return true;
          }
        }
      }
      return false;
    }

    search(items);
    return ancestors;
  }

  Future<void> _loadGitState(String rootPath) async {
    gitConfig = await _gitConfigStore.load();
    try {
      gitStatus = await _gitSync.status(rootPath, gitConfig);
      if (!gitConfig.connected) return;
      final liveUrl = gitStatus.remoteUrl;
      if (liveUrl != null && liveUrl.isNotEmpty && liveUrl != gitConfig.url) {
        gitConfig = gitConfig.copyWith(url: liveUrl);
      }
      if (gitStatus.remoteName != null &&
          gitStatus.remoteName!.isNotEmpty &&
          gitStatus.remoteName != gitConfig.remoteName) {
        gitConfig = gitConfig.copyWith(remoteName: gitStatus.remoteName);
      }
    } catch (error) {
      debugPrint('Git status failed: $error');
    }
  }

  String _gitErrorMessage(Object error, {required String fallback}) {
    if (error is StateError) return error.message;
    final text = error is GitSyncException ? error.message : '$error';
    if (text == 'auth') return appStrings.gitSyncAuthFailed;
    if (text == 'HTTPS URL required') return appStrings.gitSyncUrlRequired;
    if (text == 'token required') return appStrings.gitSyncTokenRequired;
    if (text == fallback) return fallback;
    return '$fallback: $text';
  }
}
