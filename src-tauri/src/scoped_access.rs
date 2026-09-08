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

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use objc2::rc::Retained;
    use objc2::runtime::Bool;
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

    fn path_is_directory(path: &str) -> bool {
        fs::metadata(path).map(|info| info.is_dir()).unwrap_or(true)
    }

    fn file_url(path: &str) -> Retained<NSURL> {
        NSURL::fileURLWithPath_isDirectory(&NSString::from_str(path), path_is_directory(path))
    }

    fn create_bookmark(path: &str) -> Result<Vec<u8>, String> {
        let url = file_url(path);
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

    pub fn persist_path<R: Runtime>(app: &AppHandle<R>, raw_path: &str) -> Result<(), String> {
        if !use_security_bookmarks() {
            return Ok(());
        }
        let path = normalize_fs_path(raw_path);
        if path.is_empty() {
            return Err("empty path".to_string());
        }

        let bookmark = create_bookmark(&path)?;
        let url = file_url(&path);
        if !start_accessing(&url) && !can_read_dir(&path) {
            return Err(format!("unable to start accessing {path}"));
        }
        hold(path.clone(), url);
        allow_directory(app, &path);

        let store_file = store_path(app)?;
        let mut store = load_store(&store_file);
        store.version = 1;
        store.bookmarks.insert(path, STANDARD.encode(bookmark));
        save_store(&store_file, &store)
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
                        if let Ok(fresh) = create_bookmark(&resolved) {
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
            let raw = path.to_string_lossy();
            let normalized = normalize_fs_path(&raw);
            if normalized.is_empty() {
                return;
            }
            if let Err(error) = persist_path(&handle, &normalized) {
                log::info!("[tinynote] skip scoped bookmark for {normalized}: {error}");
            }
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
