fn main() {
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
