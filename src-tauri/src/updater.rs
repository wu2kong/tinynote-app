use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use serde::Serialize;

const GITHUB_APPCAST_URL: &str =
    "https://github.com/wu2kong/tinynote-app/releases/latest/download/appcast.xml";
const QINIU_APPCAST_URL: &str = "https://qin.wu2kong.com/tinynote/updates/appcast.xml";
const RELEASES_API: &str = "https://api.github.com/repos/wu2kong/tinynote-app/releases/latest";
const USER_AGENT: &str = "TinyNote-Updater (https://github.com/wu2kong/tinynote-app)";

#[derive(Serialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Serialize)]
pub struct LatestRelease {
    pub tag_name: String,
    pub html_url: String,
    pub assets: Vec<ReleaseAsset>,
}

fn http_client(timeout_secs: u64) -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .user_agent(USER_AGENT)
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("无法创建网络请求: {e}"))
}

fn format_network_error(err: &reqwest::Error) -> String {
    if err.is_connect() || err.is_timeout() || err.is_request() {
        "下载失败，请检查网络连接是否正常".to_string()
    } else {
        format!("下载失败: {err}")
    }
}

fn xml_attr(block: &str, name: &str) -> Option<String> {
    let prefix = format!("{name}=\"");
    let start = block.find(&prefix)? + prefix.len();
    let rest = &block[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn filename_from_url(url: &str) -> String {
    url.split('/')
        .next_back()
        .unwrap_or(url)
        .split('?')
        .next()
        .unwrap_or(url)
        .to_string()
}

fn parse_appcast(xml: &str) -> Result<LatestRelease, String> {
    let version = xml
        .split("<sparkle:version>")
        .nth(1)
        .and_then(|part| part.split("</sparkle:version>").next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "更新源缺少版本信息".to_string())?;

    let mut assets = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find("<enclosure") {
        rest = &rest[start..];
        let end = rest.find("/>").unwrap_or(rest.len());
        let block = &rest[..end];
        rest = &rest[end.min(rest.len())..];
        let Some(url) = xml_attr(block, "url") else {
            continue;
        };
        let size = xml_attr(block, "length")
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(0);
        assets.push(ReleaseAsset {
            name: filename_from_url(&url),
            browser_download_url: url,
            size,
        });
    }

    if assets.is_empty() {
        return Err("更新源没有可用安装包".to_string());
    }

    Ok(LatestRelease {
        html_url: format!("https://github.com/wu2kong/tinynote-app/releases/tag/v{version}"),
        tag_name: format!("v{version}"),
        assets,
    })
}

fn forced_update_source() -> Option<&'static str> {
    match std::env::var("TINYNOTE_UPDATE_SOURCE")
        .ok()
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("qiniu") => Some("qiniu"),
        Some("github") => Some("github"),
        _ => None,
    }
}

fn github_appcast_reachable(timeout_secs: u64) -> bool {
    fetch_from_appcast(GITHUB_APPCAST_URL, timeout_secs).is_ok()
}

#[cfg_attr(not(windows), allow(dead_code))]
pub fn preferred_appcast_url() -> &'static str {
    if forced_update_source() == Some("qiniu") {
        QINIU_APPCAST_URL
    } else {
        GITHUB_APPCAST_URL
    }
}

/// GitHub first. Switch to Qiniu only when testing or GitHub is unreachable.
pub fn resolve_appcast_url() -> &'static str {
    match forced_update_source() {
        Some("qiniu") => QINIU_APPCAST_URL,
        Some("github") => GITHUB_APPCAST_URL,
        _ if github_appcast_reachable(5) => GITHUB_APPCAST_URL,
        _ => QINIU_APPCAST_URL,
    }
}

fn fetch_from_appcast(url: &str, timeout_secs: u64) -> Result<LatestRelease, String> {
    let response = http_client(timeout_secs)?
        .get(url)
        .send()
        .map_err(|e| format_network_error(&e))?;
    if !response.status().is_success() {
        return Err(format!("检查更新失败（{}）", response.status().as_u16()));
    }
    let xml = response.text().map_err(|e| format!("读取更新源失败: {e}"))?;
    parse_appcast(&xml)
}

fn fetch_from_github_api() -> Result<String, String> {
    let response = http_client(12)?
        .get(RELEASES_API)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .map_err(|e| format_network_error(&e))?;
    if !response.status().is_success() {
        return Err(format!("检查更新失败（{}）", response.status().as_u16()));
    }
    response
        .text()
        .map_err(|e| format!("读取更新信息失败: {e}"))
}

/// Try GitHub first; fall back to Qiniu when GitHub errors or is unreachable.
pub fn fetch_latest_release() -> Result<LatestRelease, String> {
    if forced_update_source() == Some("qiniu") {
        return fetch_from_appcast(QINIU_APPCAST_URL, 12);
    }

    let github_error = match fetch_from_appcast(GITHUB_APPCAST_URL, 6) {
        Ok(release) => return Ok(release),
        Err(error) => error,
    };
    if forced_update_source() != Some("github") {
        if let Ok(release) = fetch_from_appcast(QINIU_APPCAST_URL, 12) {
            return Ok(release);
        }
    }
    if let Ok(body) = fetch_from_github_api() {
        return serde_json::from_str::<serde_json::Value>(&body)
            .map_err(|e| format!("解析更新信息失败: {e}"))
            .and_then(release_from_github_json);
    }
    Err(github_error)
}

fn release_from_github_json(value: serde_json::Value) -> Result<LatestRelease, String> {
    let tag_name = value
        .get("tag_name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "更新信息缺少版本号".to_string())?
        .to_string();
    let html_url = value
        .get("html_url")
        .and_then(|v| v.as_str())
        .unwrap_or("https://github.com/wu2kong/tinynote-app/releases")
        .to_string();
    let assets = value
        .get("assets")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "更新信息缺少安装包列表".to_string())?
        .iter()
        .filter_map(|asset| {
            Some(ReleaseAsset {
                name: asset.get("name")?.as_str()?.to_string(),
                browser_download_url: asset.get("browser_download_url")?.as_str()?.to_string(),
                size: asset.get("size")?.as_u64().unwrap_or(0),
            })
        })
        .collect();
    Ok(LatestRelease {
        tag_name,
        html_url,
        assets,
    })
}

pub fn download_release_asset(url: &str, filename: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent(USER_AGENT)
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(Duration::from_secs(180))
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

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_APPCAST: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <item>
      <sparkle:version>1.2.3</sparkle:version>
      <enclosure
        url="https://qin.wu2kong.com/tinynote/releases/TinyNote_1.2.3_universal.dmg"
        length="12"
        type="application/octet-stream"
        sparkle:os="macos"
      />
    </item>
  </channel>
</rss>
"#;

    #[test]
    fn default_appcast_stays_on_github() {
        assert_eq!(preferred_appcast_url(), GITHUB_APPCAST_URL);
    }

    #[test]
    fn parse_qiniu_appcast() {
        let release = parse_appcast(SAMPLE_APPCAST).expect("appcast");
        assert_eq!(release.tag_name, "v1.2.3");
        assert_eq!(release.assets.len(), 1);
        assert_eq!(release.assets[0].name, "TinyNote_1.2.3_universal.dmg");
        assert!(release.assets[0]
            .browser_download_url
            .contains("qin.wu2kong.com/tinynote/releases/"));
    }
}
