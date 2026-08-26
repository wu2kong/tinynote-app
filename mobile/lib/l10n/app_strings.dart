import '../core/notebook_format.dart';

class AppStrings {
  AppStrings({
    required this.appTitle,
    required this.appDescription,
    required this.appTagline,
    required this.authorName,
    required this.commonCancel,
    required this.commonDelete,
    required this.commonSave,
    required this.commonCreate,
    required this.commonRename,
    required this.commonEdit,
    required this.commonCopy,
    required this.commonCopiedContent,
    required this.commonCopyContent,
    required this.commonClear,
    required this.commonClose,
    required this.commonRefresh,
    required this.commonRetry,
    required this.commonMore,
    required this.commonList,
    required this.commonSelectFolder,
    required this.commonTurnOffSync,
    required this.commonSearch,
    required this.commonUntitled,
    required this.commonEmptyContent,
    required this.settingsCenter,
    required this.displayLanguage,
    required this.displayLanguageDesc,
    required this.appearance,
    required this.colorTheme,
    required this.darkMode,
    required this.darkModeDesc,
    required this.sync,
    required this.iCloudDriveSync,
    required this.iCloudSyncUnsupported,
    required this.iCloudSyncBound,
    required this.iCloudSyncChooseFolder,
    required this.reselectFolder,
    required this.reselectFolderDesc,
    required this.data,
    required this.currentLibraryPath,
    required this.storageCloudFolder,
    required this.storageLocal,
    required this.storageCloudDesc,
    required this.storageLocalDesc,
    required this.author,
    required this.projectAuthor,
    required this.authorHomepage,
    required this.about,
    required this.projectHomepage,
    required this.openAuthorFailed,
    required this.openProjectFailed,
    required this.enableSyncTitle,
    required this.enableSyncMessage,
    required this.disableSyncTitle,
    required this.disableSyncMessage,
    required this.createSpace,
    required this.spaceName,
    required this.switchSpace,
    required this.renameSpace,
    required this.deleteSpace,
    required this.deleteSpaceMessage,
    required this.createFolder,
    required this.folderName,
    required this.createNotebook,
    required this.notebookName,
    required this.renameFolder,
    required this.renameNotebook,
    required this.deleteFolder,
    required this.deleteFolderMessage,
    required this.deleteNotebook,
    required this.deleteNotebookMessage,
    required this.createSubfolder,
    required this.spaceSection,
    required this.chooseSpace,
    required this.notebookCount,
    required this.foldersSection,
    required this.createNew,
    required this.chooseSpaceToBrowse,
    required this.emptySpace,
    required this.createFolderOrNotebook,
    required this.libraryPath,
    required this.storagePathTemplate,
    required this.noNotebookSelected,
    required this.createFailed,
    required this.deleteNoteBlock,
    required this.deleteNoteBlockMessage,
    required this.deletedNoteBlock,
    required this.deleteFailed,
    required this.initializingLibrary,
    required this.newNoteBlock,
    required this.openDirectory,
    required this.searchCurrentNotebook,
    required this.notesCount,
    required this.totalCountSuffix,
    required this.swipeLeftToDelete,
    required this.emptyNotebook,
    required this.noMatchingNotes,
    required this.chooseNotebookTitle,
    required this.openSpaceAndFolders,
    required this.chooseNotebookInSpace,
    required this.openDirectoryInstructions,
    required this.selectNoteBlockHint,
    required this.globalSearch,
    required this.matchScope,
    required this.enterKeywordSearch,
    required this.noSearchResults,
    required this.pressEnterToSearch,
    required this.searchFilterSpaceName,
    required this.searchFilterNotebookName,
    required this.searchFilterBlockTitle,
    required this.searchFilterBlockContent,
    required this.saveFailed,
    required this.clipboardEmpty,
    required this.pastedClipboard,
    required this.editNoteBlock,
    required this.titleHint,
    required this.typeLabel,
    required this.tagsHint,
    required this.contentLabel,
    required this.contentHint,
    required this.pasteClipboard,
    required this.oneTapCopy,
    required this.noteManagement,
    required this.pullUpDetails,
    required this.pullDownPreview,
    required this.commandSnippet,
    required this.contentSnippet,
    required this.codeSnippet,
    required this.bookmarkUnavailableLocal,
    required this.libraryInitFailed,
    required this.syncUnsupported,
    required this.selectICloudFolder,
    required this.copyingLocalNotes,
    required this.usingSelectedLibrary,
    required this.syncEnabled,
    required this.reselectSyncFolder,
    required this.syncFolderChanged,
    required this.copyingCloudNotes,
    required this.syncDisabledLocal,
    required this.syncFolderUnavailable,
    required this.refreshFailed,
    required this.nameRequired,
    required this.libraryNotReady,
    required this.iCloudFilesUnsupported,
    required this.pickFolderFailed,
    required this.spaceExists,
    required this.folderExists,
    required this.notebookExists,
    required this.sampleSpaceName,
    required this.sampleGroupName,
    required this.sampleNotebookName,
    required this.samplePortTitle,
    required this.sampleGitStatusTitle,
    required this.themeAuroraBlueLabel,
    required this.themeAuroraBlueDesc,
    required this.themeTealBlueLabel,
    required this.themeTealBlueDesc,
    required this.themeSakuraPinkLabel,
    required this.themeSakuraPinkDesc,
    required this.themePaperGrayLabel,
    required this.themePaperGrayDesc,
    required this.themeMatchaGreenLabel,
    required this.themeMatchaGreenDesc,
    required this.createMarkdownNotebook,
    required this.createWriterNotebook,
    required this.formatBlocks,
    required this.formatMarkdown,
    required this.formatWriter,
    required this.formatUnsupported,
    required this.convertToMarkdown,
    required this.convertToWriter,
    required this.convertFormatFailed,
    required this.convertFormatExists,
    required this.previewDocument,
    required this.documentContentHint,
    required this.documentSaved,
    required this.openLinkFailed,
    required this.documentBlocksUnsupported,
    required this.unsupportedFormatTitle,
    required this.unsupportedFormatMessage,
    required this.unsupportedFormatUpgrade,
    required this.unsupportedFormatOpenMarkdown,
    required this.unsupportedFormatOpenFailed,
    required this.importNotes,
    required this.importNotesDesc,
    required this.importNotesRuleMarkdownOnly,
    required this.importNotesRuleFormats,
    required this.importNotesRuleUnmarked,
    required this.importNotesRuleTarget,
    required this.importNotesRuleMultiple,
    required this.importNotesFiles,
    required this.importNotesDirectories,
    required this.importNotesNoSpace,
    required this.importNotesNoMarkdown,
    required this.importNotesCompleted,
    required this.importNotesFailed,
    required this.sampleLibraryPanelTitle,
    required this.sampleLibraryPanelDesc,
    required this.sampleLibraryImportLabel,
    required this.sampleLibraryImportDesc,
    required this.sampleLibraryImportAction,
    required this.sampleLibraryTitle,
    required this.sampleLibraryDescription,
    required this.sampleLibraryBlocksTitle,
    required this.sampleLibraryBlocksDesc,
    required this.sampleLibraryMarkdownTitle,
    required this.sampleLibraryMarkdownDesc,
    required this.sampleLibraryWriterTitle,
    required this.sampleLibraryWriterDesc,
    required this.sampleLibraryContentLanguage,
    required this.sampleLibrarySafeImportNote,
    required this.sampleLibraryNotNow,
    required this.sampleLibraryImporting,
    required this.sampleLibraryImported,
    required this.sampleLibraryImportFailed,
    required this.feedbackPanelTitle,
    required this.feedbackPanelDesc,
    required this.feedbackEmail,
    required this.feedbackEmailDesc,
    required this.feedbackWriteEmail,
    required this.feedbackCopyEmail,
    required this.feedbackEmailCopied,
    required this.feedbackCopyInfo,
    required this.feedbackCopied,
    required this.feedbackInfoCopied,
    required this.feedbackBugHint,
    required this.feedbackMailSubject,
    required this.feedbackMailBodyHint,
    required this.feedbackOpenMailFailed,
    required this.feedbackRuntimeMobile,
    required this.copyFailed,
    required this.helpDocs,
    required this.openHelpDocsFailed,
  });

  final String appTitle;
  final String appDescription;
  final String appTagline;
  final String authorName;
  final String commonCancel;
  final String commonDelete;
  final String commonSave;
  final String commonCreate;
  final String commonRename;
  final String commonEdit;
  final String commonCopy;
  final String commonCopiedContent;
  final String commonCopyContent;
  final String commonClear;
  final String commonClose;
  final String commonRefresh;
  final String commonRetry;
  final String commonMore;
  final String commonList;
  final String commonSelectFolder;
  final String commonTurnOffSync;
  final String commonSearch;
  final String commonUntitled;
  final String commonEmptyContent;
  final String settingsCenter;
  final String displayLanguage;
  final String displayLanguageDesc;
  final String appearance;
  final String colorTheme;
  final String darkMode;
  final String darkModeDesc;
  final String sync;
  final String iCloudDriveSync;
  final String iCloudSyncUnsupported;
  final String iCloudSyncBound;
  final String iCloudSyncChooseFolder;
  final String reselectFolder;
  final String reselectFolderDesc;
  final String data;
  final String currentLibraryPath;
  final String storageCloudFolder;
  final String storageLocal;
  final String storageCloudDesc;
  final String storageLocalDesc;
  final String author;
  final String projectAuthor;
  final String authorHomepage;
  final String about;
  final String projectHomepage;
  final String openAuthorFailed;
  final String openProjectFailed;
  final String enableSyncTitle;
  final String enableSyncMessage;
  final String disableSyncTitle;
  final String disableSyncMessage;
  final String createSpace;
  final String spaceName;
  final String switchSpace;
  final String renameSpace;
  final String deleteSpace;
  final String deleteSpaceMessage;
  final String createFolder;
  final String folderName;
  final String createNotebook;
  final String notebookName;
  final String renameFolder;
  final String renameNotebook;
  final String deleteFolder;
  final String deleteFolderMessage;
  final String deleteNotebook;
  final String deleteNotebookMessage;
  final String createSubfolder;
  final String spaceSection;
  final String chooseSpace;
  final String notebookCount;
  final String foldersSection;
  final String createNew;
  final String chooseSpaceToBrowse;
  final String emptySpace;
  final String createFolderOrNotebook;
  final String libraryPath;
  final String storagePathTemplate;
  final String noNotebookSelected;
  final String createFailed;
  final String deleteNoteBlock;
  final String deleteNoteBlockMessage;
  final String deletedNoteBlock;
  final String deleteFailed;
  final String initializingLibrary;
  final String newNoteBlock;
  final String openDirectory;
  final String searchCurrentNotebook;
  final String notesCount;
  final String totalCountSuffix;
  final String swipeLeftToDelete;
  final String emptyNotebook;
  final String noMatchingNotes;
  final String chooseNotebookTitle;
  final String openSpaceAndFolders;
  final String chooseNotebookInSpace;
  final String openDirectoryInstructions;
  final String selectNoteBlockHint;
  final String globalSearch;
  final String matchScope;
  final String enterKeywordSearch;
  final String noSearchResults;
  final String pressEnterToSearch;
  final String searchFilterSpaceName;
  final String searchFilterNotebookName;
  final String searchFilterBlockTitle;
  final String searchFilterBlockContent;
  final String saveFailed;
  final String clipboardEmpty;
  final String pastedClipboard;
  final String editNoteBlock;
  final String titleHint;
  final String typeLabel;
  final String tagsHint;
  final String contentLabel;
  final String contentHint;
  final String pasteClipboard;
  final String oneTapCopy;
  final String noteManagement;
  final String pullUpDetails;
  final String pullDownPreview;
  final String commandSnippet;
  final String contentSnippet;
  final String codeSnippet;
  final String bookmarkUnavailableLocal;
  final String libraryInitFailed;
  final String syncUnsupported;
  final String selectICloudFolder;
  final String copyingLocalNotes;
  final String usingSelectedLibrary;
  final String syncEnabled;
  final String reselectSyncFolder;
  final String syncFolderChanged;
  final String copyingCloudNotes;
  final String syncDisabledLocal;
  final String syncFolderUnavailable;
  final String refreshFailed;
  final String nameRequired;
  final String libraryNotReady;
  final String iCloudFilesUnsupported;
  final String pickFolderFailed;
  final String spaceExists;
  final String folderExists;
  final String notebookExists;
  final String sampleSpaceName;
  final String sampleGroupName;
  final String sampleNotebookName;
  final String samplePortTitle;
  final String sampleGitStatusTitle;
  final String themeAuroraBlueLabel;
  final String themeAuroraBlueDesc;
  final String themeTealBlueLabel;
  final String themeTealBlueDesc;
  final String themeSakuraPinkLabel;
  final String themeSakuraPinkDesc;
  final String themePaperGrayLabel;
  final String themePaperGrayDesc;
  final String themeMatchaGreenLabel;
  final String themeMatchaGreenDesc;
  final String createMarkdownNotebook;
  final String createWriterNotebook;
  final String formatBlocks;
  final String formatMarkdown;
  final String formatWriter;
  final String formatUnsupported;
  final String convertToMarkdown;
  final String convertToWriter;
  final String convertFormatFailed;
  final String convertFormatExists;
  final String previewDocument;
  final String documentContentHint;
  final String documentSaved;
  final String openLinkFailed;
  final String documentBlocksUnsupported;
  final String unsupportedFormatTitle;
  final String unsupportedFormatMessage;
  final String unsupportedFormatUpgrade;
  final String unsupportedFormatOpenMarkdown;
  final String unsupportedFormatOpenFailed;
  final String importNotes;
  final String importNotesDesc;
  final String importNotesRuleMarkdownOnly;
  final String importNotesRuleFormats;
  final String importNotesRuleUnmarked;
  final String importNotesRuleTarget;
  final String importNotesRuleMultiple;
  final String importNotesFiles;
  final String importNotesDirectories;
  final String importNotesNoSpace;
  final String importNotesNoMarkdown;
  final String importNotesCompleted;
  final String importNotesFailed;
  final String sampleLibraryPanelTitle;
  final String sampleLibraryPanelDesc;
  final String sampleLibraryImportLabel;
  final String sampleLibraryImportDesc;
  final String sampleLibraryImportAction;
  final String sampleLibraryTitle;
  final String sampleLibraryDescription;
  final String sampleLibraryBlocksTitle;
  final String sampleLibraryBlocksDesc;
  final String sampleLibraryMarkdownTitle;
  final String sampleLibraryMarkdownDesc;
  final String sampleLibraryWriterTitle;
  final String sampleLibraryWriterDesc;
  final String sampleLibraryContentLanguage;
  final String sampleLibrarySafeImportNote;
  final String sampleLibraryNotNow;
  final String sampleLibraryImporting;
  final String sampleLibraryImported;
  final String sampleLibraryImportFailed;
  final String feedbackPanelTitle;
  final String feedbackPanelDesc;
  final String feedbackEmail;
  final String feedbackEmailDesc;
  final String feedbackWriteEmail;
  final String feedbackCopyEmail;
  final String feedbackEmailCopied;
  final String feedbackCopyInfo;
  final String feedbackCopied;
  final String feedbackInfoCopied;
  final String feedbackBugHint;
  final String feedbackMailSubject;
  final String feedbackMailBodyHint;
  final String feedbackOpenMailFailed;
  final String feedbackRuntimeMobile;
  final String copyFailed;
  final String helpDocs;
  final String openHelpDocsFailed;

  String formatLabel(NotebookFormat format) {
    return switch (format) {
      NotebookFormat.blocks => formatBlocks,
      NotebookFormat.markdown => formatMarkdown,
      NotebookFormat.writer => formatWriter,
      NotebookFormat.unsupported => formatUnsupported,
    };
  }

  String tr(String template, [Map<String, String>? params]) {
    if (params == null || params.isEmpty) return template;
    var result = template;
    for (final entry in params.entries) {
      result = result.replaceAll('{${entry.key}}', entry.value);
    }
    return result;
  }

  String fill(String template, Map<String, String> params) =>
      tr(template, params);
}
