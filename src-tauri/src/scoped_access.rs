use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_fs::FsExt;

const STORE_FILE: &str = ".scoped-bookmarks.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopedAccessState {
    pub accessible: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct BookmarkStore {
    version: u32,
    bookmarks: HashMap<String, String>,
}

fn normalize_fs_path(path: &str) -> String {
    let trimmed = path.trim();
    let without_glob = trimmed
        .strip_suffix("/**")
        .or_else(|| trimmed.strip_suffix("/*"))
        .unwrap_or(trimmed)
        .trim_end_matches(['*', '/']);
    if without_glob.is_empty() {
        trimmed.to_string()
    } else {
        without_glob.to_string()
    }
}

fn can_read_dir(path: &str) -> bool {
    fs::read_dir(path).is_ok()
}

fn is_sandboxed() -> bool {
    std::env::var_os("APP_SANDBOX_CONTAINER_ID").is_some()
}

fn use_security_bookmarks() -> bool {
    is_sandboxed() && !cfg!(debug_assertions)
}

fn store_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(STORE_FILE))
}

fn load_store(path: &Path) -> BookmarkStore {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn save_store(path: &Path, store: &BookmarkStore) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let payload = serde_json::to_vec_pretty(store).map_err(|e| e.to_string())?;
    fs::write(path, payload).map_err(|e| e.to_string())
}

thread_local! {
    static ALLOWING_DIRECTORY: Cell<bool> = const { Cell::new(false) };
}

fn allow_directory<R: Runtime>(app: &AppHandle<R>, path: &str) {
    ALLOWING_DIRECTORY.with(|flag| {
        if flag.get() {
            return;
        }
        flag.set(true);
        if let Some(scope) = app.try_fs_scope() {
            let _ = scope.allow_directory(Path::new(path), true);
        }
        flag.set(false);
    });
}

fn is_app_data_path<R: Runtime>(app: &AppHandle<R>, path: &str) -> bool {
    let Ok(app_data) = app.path().app_data_dir() else {
        return false;
    };
    Path::new(path).starts_with(&app_data)
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use objc2::rc::Retained;
    use objc2::runtime::Bool;
    use objc2_app_kit::{NSApplication, NSModalResponseOK, NSOpenPanel};
    use objc2_foundation::{
        NSData, NSError, NSString, NSURL, NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions,
    };
    use std::sync::{Mutex, OnceLock};

    #[allow(dead_code)]
    struct HeldUrl(Retained<NSURL>);
    unsafe impl Send for HeldUrl {}
    unsafe impl Sync for HeldUrl {}

    fn held_urls() -> &'static Mutex<HashMap<String, HeldUrl>> {
        static HELD: OnceLock<Mutex<HashMap<String, HeldUrl>>> = OnceLock::new();
        HELD.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn hold(path: String, url: Retained<NSURL>) {
        if let Ok(mut guard) = held_urls().lock() {
            guard.insert(path, HeldUrl(url));
        }
    }

    fn claimed_paths() -> &'static Mutex<HashMap<String, bool>> {
        static CLAIMED: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();
        CLAIMED.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn mark_persisted(path: &str, from_panel: bool) -> bool {
        let Ok(mut guard) = claimed_paths().lock() else {
            return true;
        };
        if !from_panel && guard.contains_key(path) {
            return false;
        }
        guard.insert(path.to_string(), from_panel);
        true
    }

    fn path_is_directory(path: &str) -> bool {
        fs::metadata(path).map(|info| info.is_dir()).unwrap_or(true)
    }

    fn file_url(path: &str) -> Retained<NSURL> {
        NSURL::fileURLWithPath_isDirectory(&NSString::from_str(path), path_is_directory(path))
    }

    fn create_bookmark_from_url(url: &NSURL) -> Result<Vec<u8>, String> {
        url.bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            NSURLBookmarkCreationOptions::WithSecurityScope,
            None,
            None,
        )
        .map(|data| data.to_vec())
        .map_err(|err: Retained<NSError>| err.localizedDescription().to_string())
    }

    fn resolve_bookmark(bytes: &[u8]) -> Result<(Retained<NSURL>, bool), String> {
        let data = NSData::with_bytes(bytes);
        let mut is_stale = Bool::NO;
        let url = unsafe {
            NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
                &data,
                NSURLBookmarkResolutionOptions::WithSecurityScope,
                None,
                &mut is_stale,
            )
        }
        .map_err(|err: Retained<NSError>| err.localizedDescription().to_string())?;
        Ok((url, is_stale.as_bool()))
    }

    fn start_accessing(url: &NSURL) -> bool {
        unsafe { url.startAccessingSecurityScopedResource() }
    }

    fn resolved_path(url: &NSURL) -> Option<String> {
        url.path().map(|path| path.to_string())
    }

    fn persist_selected_url<R: Runtime>(
        app: &AppHandle<R>,
        url: Retained<NSURL>,
        from_panel: bool,
    ) -> Result<String, String> {
        let path = normalize_fs_path(&resolved_path(&url).ok_or_else(|| "empty path".to_string())?);
        if path.is_empty() {
            return Err("empty path".to_string());
        }
        if !mark_persisted(&path, from_panel) {
            allow_directory(app, &path);
            return Ok(path);
        }

        let started = start_accessing(&url);
        hold(path.clone(), Retained::clone(&url));
        allow_directory(app, &path);

        if !use_security_bookmarks() {
            return Ok(path);
        }

        match create_bookmark_from_url(&url) {
            Ok(bookmark) => {
                if let Ok(store_file) = store_path(app) {
                    let mut store = load_store(&store_file);
                    store.version = 1;
                    store.bookmarks.insert(path.clone(), STANDARD.encode(bookmark));
                    if let Err(error) = save_store(&store_file, &store) {
                        log::warn!("[tinynote] failed to save scoped bookmark for {path}: {error}");
                    }
                }
            }
            Err(error) => {
                log::warn!("[tinynote] failed to create scoped bookmark for {path}: {error}");
                if !started && !can_read_dir(&path) {
                    return Err(format!("unable to start accessing {path}: {error}"));
                }
            }
        }

        Ok(path)
    }

    pub fn persist_path<R: Runtime>(app: &AppHandle<R>, raw_path: &str) -> Result<(), String> {
        let path = normalize_fs_path(raw_path);
        if path.is_empty() {
            return Err("empty path".to_string());
        }
        if !use_security_bookmarks() {
            allow_directory(app, &path);
            return Ok(());
        }
        match persist_selected_url(app, file_url(&path), false) {
            Ok(_) => Ok(()),
            Err(error) => {
                // Session access from NSOpenPanel / Powerbox may still work even if
                // reconstituting a security-scoped bookmark from a path fails.
                if can_read_dir(&path) {
                    log::warn!("[tinynote] keep session access for {path} without bookmark: {error}");
                    Ok(())
                } else {
                    Err(error)
                }
            }
        }
    }

    pub fn restore_all<R: Runtime>(app: &AppHandle<R>) {
        if !use_security_bookmarks() {
            return;
        }
        let Ok(store_file) = store_path(app) else { return };
        let store = load_store(&store_file);
        let mut dirty = false;
        let mut next = store.bookmarks.clone();

        for (path, encoded) in &store.bookmarks {
            let Ok(bytes) = STANDARD.decode(encoded) else {
                log::warn!("[tinynote] ignored invalid scoped bookmark for {path}");
                continue;
            };

            match resolve_bookmark(&bytes) {
                Ok((url, stale)) => {
                    if !start_accessing(&url) {
                        log::warn!("[tinynote] failed to start scoped access for {path}");
                        continue;
                    }
                    let resolved = resolved_path(&url).unwrap_or_else(|| path.clone());
                    allow_directory(app, &resolved);
                    if resolved != *path {
                        allow_directory(app, path);
                    }
                    hold(resolved.clone(), url);

                    if stale {
                        if let Ok(fresh) = create_bookmark_from_url(&file_url(&resolved)) {
                            next.remove(path);
                            next.insert(resolved, STANDARD.encode(fresh));
                            dirty = true;
                        }
                    }
                }
                Err(error) => {
                    log::warn!("[tinynote] failed to resolve scoped bookmark for {path}: {error}");
                }
            }
        }

        if dirty {
            let refreshed = BookmarkStore { version: 1, bookmarks: next };
            if let Err(error) = save_store(&store_file, &refreshed) {
                log::warn!("[tinynote] failed to refresh scoped bookmarks: {error}");
            }
        }
    }

    pub fn ensure_path<R: Runtime>(app: &AppHandle<R>, raw_path: &str) -> ScopedAccessState {
        let path = normalize_fs_path(raw_path);
        if path.is_empty() {
            return ScopedAccessState { accessible: false };
        }
        if is_app_data_path(app, &path) {
            if !can_read_dir(&path) {
                let _ = fs::create_dir_all(&path);
            }
            allow_directory(app, &path);
            return ScopedAccessState {
                accessible: can_read_dir(&path),
            };
        }
        if can_read_dir(&path) {
            allow_directory(app, &path);
            return ScopedAccessState { accessible: true };
        }
        if !use_security_bookmarks() {
            allow_directory(app, &path);
            return ScopedAccessState { accessible: true };
        }
        restore_all(app);
        ScopedAccessState {
            accessible: can_read_dir(&path),
        }
    }

    pub fn pick_and_persist_workspace_folder<R: Runtime>(
        app: AppHandle<R>,
    ) -> Result<Option<String>, String> {
        dispatch2::run_on_main(move |mtm| {
            let panel = NSOpenPanel::openPanel(mtm);
            panel.setCanChooseFiles(false);
            panel.setCanChooseDirectories(true);
            panel.setAllowsMultipleSelection(false);
            panel.setCanCreateDirectories(true);
            // Use a standalone modal, not a window sheet. Mixing beginSheet + runModal
            // (as rfd does when a parent window is set) can fail to return after OK.
            #[allow(deprecated)]
            NSApplication::sharedApplication(mtm).activateIgnoringOtherApps(true);
            if panel.runModal() != NSModalResponseOK {
                return Ok(None);
            }
            let Some(url) = panel.URL() else {
                return Err("folder picker did not return a URL".to_string());
            };
            persist_selected_url(&app, url, true).map(Some)
        })
    }
}

#[cfg(not(target_os = "macos"))]
mod macos {
    use super::*;

    pub fn persist_path<R: Runtime>(_app: &AppHandle<R>, _path: &str) -> Result<(), String> {
        Ok(())
    }

    pub fn restore_all<R: Runtime>(_app: &AppHandle<R>) {}

    pub fn ensure_path<R: Runtime>(_app: &AppHandle<R>, _path: &str) -> ScopedAccessState {
        ScopedAccessState { accessible: true }
    }

    pub fn pick_and_persist_workspace_folder<R: Runtime>(
        _app: AppHandle<R>,
    ) -> Result<Option<String>, String> {
        Err("folder picker is only available on macOS".to_string())
    }
}

pub fn persist_path<R: Runtime>(app: &AppHandle<R>, path: &str) -> Result<(), String> {
    macos::persist_path(app, path)
}

pub fn restore_all<R: Runtime>(app: &AppHandle<R>) {
    macos::restore_all(app);
}

pub fn ensure_path<R: Runtime>(app: &AppHandle<R>, path: &str) -> ScopedAccessState {
    macos::ensure_path(app, path)
}

pub fn listen_for_allowed_paths<R: Runtime>(app: &AppHandle<R>) {
    if !use_security_bookmarks() {
        return;
    }
    let Some(scope) = app.try_fs_scope() else { return };
    let handle = app.clone();
    scope.listen(move |event| {
        if let tauri::fs::Event::PathAllowed(path) = event {
            let normalized = normalize_fs_path(&path.to_string_lossy());
            if normalized.is_empty() {
                return;
            }
            let handle = handle.clone();
            std::thread::spawn(move || {
                if let Err(error) = persist_path(&handle, &normalized) {
                    log::info!("[tinynote] skip scoped bookmark for {normalized}: {error}");
                }
            });
        }
    });
}

#[tauri::command]
pub fn persist_scoped_access<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    persist_path(&app, &path)
}

#[tauri::command]
pub fn ensure_scoped_access<R: Runtime>(app: AppHandle<R>, path: String) -> ScopedAccessState {
    ensure_path(&app, &path)
}

#[tauri::command]
pub fn pick_and_persist_workspace_folder<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<String>, String> {
    macos::pick_and_persist_workspace_folder(app)
}
