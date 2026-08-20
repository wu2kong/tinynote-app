use std::ffi::CString;
use std::path::PathBuf;
use std::sync::OnceLock;

use libloading::{Library, Symbol};
use tauri::{AppHandle, Manager, Runtime};

const APPCAST_URL: &str =
    "https://github.com/wu2kong/tinynote-app/releases/latest/download/appcast.xml";
/// Keep in sync with `src-tauri/Info.plist` `SUPublicEDKey`.
const EDDSA_PUBLIC_KEY: &str = "iuoIi1Gqa16zHOpgGPGmVPlmK+9XXMx/dPrOssrSXO0=";
const CHECK_INTERVAL_SECS: i32 = 86_400;

struct WinSparkleState {
    lib: Library,
}

static STATE: OnceLock<WinSparkleState> = OnceLock::new();

unsafe extern "C" fn can_shutdown() -> i32 {
    1
}

unsafe extern "C" fn shutdown_request() {
    std::process::exit(0);
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

fn dll_candidates<R: Runtime>(app: &AppHandle<R>) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            paths.push(dir.join("WinSparkle.dll"));
            paths.push(dir.join("resources").join("WinSparkle.dll"));
            paths.push(dir.join("resources").join("winsparkle").join("WinSparkle.dll"));
            paths.push(dir.join("winsparkle").join("WinSparkle.dll"));
        }
    }
    if let Ok(dir) = app.path().resource_dir() {
        paths.push(dir.join("WinSparkle.dll"));
        paths.push(dir.join("winsparkle").join("WinSparkle.dll"));
    }
    paths.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("winsparkle")
            .join("WinSparkle.dll"),
    );
    paths
}

fn find_dll<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    dll_candidates(app)
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "未找到 WinSparkle.dll".to_string())
}

pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if STATE.get().is_some() {
        return Ok(());
    }

    let dll_path = find_dll(app)?;
    let lib = unsafe {
        Library::new(&dll_path).map_err(|error| format!("无法加载 WinSparkle.dll: {error}"))?
    };

    let appcast = CString::new(APPCAST_URL).map_err(|error| error.to_string())?;
    let pubkey = CString::new(EDDSA_PUBLIC_KEY).map_err(|error| error.to_string())?;
    let company = wide("TinyNote");
    let app_name = wide("TinyNote");
    let version = wide(&app.package_info().version.to_string());

    unsafe {
        let set_appcast: Symbol<unsafe extern "C" fn(*const std::ffi::c_char)> = lib
            .get(b"win_sparkle_set_appcast_url")
            .map_err(|error| error.to_string())?;
        set_appcast(appcast.as_ptr());

        let set_key: Symbol<unsafe extern "C" fn(*const std::ffi::c_char) -> i32> = lib
            .get(b"win_sparkle_set_eddsa_public_key")
            .map_err(|error| error.to_string())?;
        if set_key(pubkey.as_ptr()) == 0 {
            return Err("WinSparkle EdDSA 公钥无效".to_string());
        }

        let set_details: Symbol<unsafe extern "C" fn(*const u16, *const u16, *const u16)> = lib
            .get(b"win_sparkle_set_app_details")
            .map_err(|error| error.to_string())?;
        set_details(company.as_ptr(), app_name.as_ptr(), version.as_ptr());

        let set_auto: Symbol<unsafe extern "C" fn(i32)> = lib
            .get(b"win_sparkle_set_automatic_check_for_updates")
            .map_err(|error| error.to_string())?;
        set_auto(1);

        let set_interval: Symbol<unsafe extern "C" fn(i32)> = lib
            .get(b"win_sparkle_set_update_check_interval")
            .map_err(|error| error.to_string())?;
        set_interval(CHECK_INTERVAL_SECS);

        let set_can_shutdown: Symbol<unsafe extern "C" fn(unsafe extern "C" fn() -> i32)> = lib
            .get(b"win_sparkle_set_can_shutdown_callback")
            .map_err(|error| error.to_string())?;
        set_can_shutdown(can_shutdown);

        let set_shutdown: Symbol<unsafe extern "C" fn(unsafe extern "C" fn())> = lib
            .get(b"win_sparkle_set_shutdown_request_callback")
            .map_err(|error| error.to_string())?;
        set_shutdown(shutdown_request);

        let init_fn: Symbol<unsafe extern "C" fn()> = lib
            .get(b"win_sparkle_init")
            .map_err(|error| error.to_string())?;
        init_fn();
    }

    STATE
        .set(WinSparkleState { lib })
        .map_err(|_| "WinSparkle 重复初始化".to_string())?;
    Ok(())
}

pub fn is_available() -> bool {
    STATE.get().is_some()
}

pub fn check_for_updates() -> Result<(), String> {
    let state = STATE.get().ok_or_else(|| "WinSparkle 未初始化".to_string())?;
    unsafe {
        let check: Symbol<unsafe extern "C" fn()> = state
            .lib
            .get(b"win_sparkle_check_update_with_ui")
            .map_err(|error| error.to_string())?;
        check();
    }
    Ok(())
}

pub fn cleanup() {
    let Some(state) = STATE.get() else {
        return;
    };
    unsafe {
        if let Ok(cleanup_fn) = state.lib.get::<unsafe extern "C" fn()>(b"win_sparkle_cleanup") {
            cleanup_fn();
        }
    }
}
