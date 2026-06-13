use std::fs;
use std::path::PathBuf;

fn format_network_error(err: &reqwest::Error) -> String {
    if err.is_connect() || err.is_timeout() || err.is_request() {
        "下载失败，请检查网络连接是否正常".to_string()
    } else {
        format!("下载失败: {err}")
    }
}

pub fn download_release_asset(url: &str, filename: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("TinyNote-Updater")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("无法创建下载客户端: {e}"))?;

    let response = client
        .get(url)
        .send()
        .map_err(|e| format_network_error(&e))?;

    if !response.status().is_success() {
        return Err(format!("下载失败 (HTTP {})", response.status()));
    }

    let bytes = response
        .bytes()
        .map_err(|e| format_network_error(&e))?;

    let file_path = sanitize_temp_path(filename)?;
    fs::write(&file_path, &bytes).map_err(|e| format!("无法保存安装包: {e}"))?;

    Ok(file_path.to_string_lossy().into_owned())
}

fn sanitize_temp_path(filename: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(filename);
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.is_empty() && !n.contains(".."))
        .ok_or_else(|| "无效的安装包文件名".to_string())?;

    Ok(std::env::temp_dir().join(name))
}
