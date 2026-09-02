fn main() {
    let manifest_dir = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let llm_permission = manifest_dir.join("permissions").join("allow-llm.toml");
    let default_capability = manifest_dir.join("capabilities").join("default.json");

    if std::env::var_os("CARGO_FEATURE_APP_STORE").is_some() {
        let _ = std::fs::remove_file(&llm_permission);
        let _ = std::fs::remove_file(&default_capability);
    } else {
        std::fs::write(
            &llm_permission,
            include_str!("permission-templates/allow-llm.toml"),
        )
        .expect("failed to generate LLM permission for direct distribution");
        std::fs::write(
            &default_capability,
            include_str!("capability-templates/default.json"),
        )
        .expect("failed to generate direct-distribution capability");
    }

    println!("cargo:rerun-if-changed=permission-templates/allow-llm.toml");
    println!("cargo:rerun-if-changed=capability-templates/default.json");

    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "windows" {
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
