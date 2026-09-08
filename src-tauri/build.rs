fn write_if_changed(path: &std::path::Path, contents: &str) {
    if std::fs::read_to_string(path).ok().as_deref() == Some(contents) {
        return;
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).expect("failed to create generated config directory");
    }
    std::fs::write(path, contents).unwrap_or_else(|error| {
        panic!("failed to write {}: {error}", path.display());
    });
}

fn remove_if_exists(path: &std::path::Path) {
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
}

fn main() {
    let manifest_dir = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let llm_permission = manifest_dir.join("permissions").join("allow-llm.toml");
    let default_capability = manifest_dir.join("capabilities").join("default.json");

    if std::env::var_os("CARGO_FEATURE_APP_STORE").is_some() {
        remove_if_exists(&llm_permission);
        remove_if_exists(&default_capability);
    } else {
        write_if_changed(
            &llm_permission,
            include_str!("permission-templates/allow-llm.toml"),
        );
        write_if_changed(
            &default_capability,
            include_str!("capability-templates/default.json"),
        );
    }

    println!("cargo:rerun-if-changed=permission-templates/allow-llm.toml");
    println!("cargo:rerun-if-changed=capability-templates/default.json");

    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "windows"
        && std::env::var_os("CARGO_FEATURE_MICROSOFT_STORE").is_none()
    {
        let dll = std::path::Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap())
            .join("winsparkle")
            .join("WinSparkle.dll");
        if !dll.exists() {
            panic!(
                "WinSparkle.dll not found at {}. Run: bash scripts/download-winsparkle.sh",
                dll.display()
            );
        }
    }
    tauri_build::build()
}
