use chrono::Local;
use serde::Serialize;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

const BACKUP_PREFIX: &str = "tinynotes-";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub filename: String,
    pub time_display: Option<String>,
    pub size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStats {
    pub count: u32,
    pub latest_filename: Option<String>,
    pub latest_time_display: Option<String>,
    pub files: Vec<BackupFile>,
}

fn backup_filename() -> String {
    let now = Local::now();
    format!(
        "tinynotes-{}-{}-{}.zip",
        now.format("%Y"),
        now.format("%m%d"),
        now.format("%H%M%S")
    )
}

fn parse_backup_time_display(filename: &str) -> Option<String> {
    let name = filename.strip_suffix(".zip")?;
    let rest = name.strip_prefix("tinynotes-")?;
    let parts: Vec<&str> = rest.split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let year = parts[0];
    let md = parts[1];
    let hms = parts[2];
    if year.len() != 4 || md.len() != 4 || hms.len() != 6 {
        return None;
    }
    Some(format!(
        "{}-{}-{} {}:{}:{}",
        year,
        &md[0..2],
        &md[2..4],
        &hms[0..2],
        &hms[2..4],
        &hms[4..6]
    ))
}

pub fn get_backup_stats(backup_dir: &str) -> Result<BackupStats, String> {
    let dir = Path::new(backup_dir);
    if !dir.exists() {
        return Ok(BackupStats {
            count: 0,
            latest_filename: None,
            latest_time_display: None,
            files: Vec::new(),
        });
    }

    let mut files: Vec<BackupFile> = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with(BACKUP_PREFIX) || !name.ends_with(".zip") {
            continue;
        }
        let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
        files.push(BackupFile {
            time_display: parse_backup_time_display(&name),
            filename: name,
            size_bytes,
        });
    }

    files.sort_by(|a, b| b.filename.cmp(&a.filename));

    let latest = files.first().cloned();
    Ok(BackupStats {
        count: files.len() as u32,
        latest_filename: latest.as_ref().map(|f| f.filename.clone()),
        latest_time_display: latest.as_ref().and_then(|f| f.time_display.clone()),
        files,
    })
}

fn add_file_to_zip<W: Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    path: &Path,
    name_in_zip: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
    zip.start_file(name_in_zip, options)
        .map_err(|e| e.to_string())?;
    zip.write_all(&buffer).map_err(|e| e.to_string())?;
    Ok(())
}

fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    dir: &Path,
    prefix_in_zip: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let relative = path.strip_prefix(dir).map_err(|e| e.to_string())?;
        let relative_str = relative.to_string_lossy().replace('\\', "/");
        let name_in_zip = if prefix_in_zip.is_empty() {
            relative_str
        } else {
            format!("{prefix_in_zip}/{relative_str}")
        };
        add_file_to_zip(zip, path, &name_in_zip, options)?;
    }
    Ok(())
}

pub fn create_backup(
    backup_dir: &str,
    storage_path: Option<&str>,
    config_path: &str,
) -> Result<String, String> {
    std::fs::create_dir_all(backup_dir).map_err(|e| e.to_string())?;

    let filename = backup_filename();
    let zip_path = PathBuf::from(backup_dir).join(&filename);

    let file = File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let config = Path::new(config_path);
    if config.is_file() {
        add_file_to_zip(&mut zip, config, "configs.json", options)?;
    }

    if let Some(storage) = storage_path {
        let notes_dir = Path::new(storage);
        if notes_dir.is_dir() {
            add_dir_to_zip(&mut zip, notes_dir, "notes", options)?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(filename)
}
