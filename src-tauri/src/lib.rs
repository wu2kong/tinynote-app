mod backup;
mod sync;
mod updater;

use std::collections::HashMap;
use std::io::Read;
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

use backup::{create_backup as run_create_backup, get_backup_stats as run_get_backup_stats, BackupStats};
use sync::{
    get_file_diff as run_get_file_diff, get_git_status as run_get_git_status,
    git_pull as run_git_pull, git_sync_push as run_git_sync_push,
    revert_file_change as run_revert_file_change, FileDiff, GitSyncStatus,
};

static LLM_STREAM_CANCELLATIONS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

fn llm_stream_cancellations() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    LLM_STREAM_CANCELLATIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[tauri::command]
fn get_app_dir() -> Result<String, String> {
    std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "无法获取程序目录".to_string())
}

#[tauri::command]
fn get_backup_stats(backup_dir: String) -> Result<BackupStats, String> {
    run_get_backup_stats(&backup_dir)
}

#[tauri::command]
fn create_backup(
    backup_dir: String,
    storage_path: Option<String>,
    config_path: String,
) -> Result<String, String> {
    run_create_backup(
        &backup_dir,
        storage_path.as_deref(),
        &config_path,
    )
}

#[tauri::command]
fn get_git_status(storage_path: String) -> Result<GitSyncStatus, String> {
    run_get_git_status(&storage_path)
}

#[tauri::command]
fn git_pull(storage_path: String) -> Result<(), String> {
    run_git_pull(&storage_path)
}

#[tauri::command]
fn git_sync_push(storage_path: String) -> Result<String, String> {
    run_git_sync_push(&storage_path)
}

#[tauri::command]
fn get_file_diff(storage_path: String, file_path: String) -> Result<FileDiff, String> {
    run_get_file_diff(&storage_path, &file_path)
}

#[tauri::command]
fn revert_file_change(storage_path: String, file_path: String) -> Result<(), String> {
    run_revert_file_change(&storage_path, &file_path)
}

#[tauri::command]
fn download_release_asset(url: String, filename: String) -> Result<String, String> {
    updater::download_release_asset(&url, &filename)
}

/// Fetch a provider model list outside the webview so OpenAI-compatible APIs
/// without browser CORS headers can still be used by the desktop application.
#[tauri::command]
fn fetch_llm_models(base_url: String, api_key: Option<String>) -> Result<String, String> {
    let endpoint = format!("{}/models", base_url.trim_end_matches('/'));
    let url = reqwest::Url::parse(&endpoint)
        .map_err(|_| "API 地址无效".to_string())?;
    if !matches!(url.scheme(), "https" | "http") {
        return Err("API 地址必须使用 HTTP 或 HTTPS".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("无法创建网络请求: {e}"))?;
    let mut request = client.get(url);
    if let Some(key) = api_key.as_ref().filter(|key| !key.trim().is_empty()) {
        request = request.bearer_auth(key.trim());
    }

    let response = request.send().map_err(|e| {
        if e.is_connect() || e.is_timeout() || e.is_request() {
            "网络请求失败，请检查网络连接或 API 地址".to_string()
        } else {
            format!("获取模型列表失败: {e}")
        }
    })?;
    if !response.status().is_success() {
        return Err(format!("请求失败（HTTP {}）", response.status()));
    }
    response.text().map_err(|e| format!("读取模型列表失败: {e}"))
}

#[derive(Deserialize, Serialize)]
struct LlmChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct LlmStreamEvent {
    kind: String,
    content: String,
}

fn stream_delta(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("delta"))
        .and_then(|delta| delta.get("content"))
        .and_then(|content| content.as_str())
        .map(String::from)
        .or_else(|| payload.get("delta").and_then(|delta| delta.as_str()).map(String::from))
}

fn completion_text(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("output_text")
        .and_then(|content| content.as_str())
        .map(String::from)
        .or_else(|| payload
            .get("choices")
            .and_then(|choices| choices.get(0))
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_str())
            .map(String::from))
        .or_else(|| payload
            .get("output")
            .and_then(|output| output.as_array())
            .and_then(|items| items.iter().find_map(|item| item.get("content").and_then(|content| content.as_array())))
            .and_then(|content| content.iter().find_map(|item| item.get("text").and_then(|text| text.as_str())))
            .map(String::from))
}

fn run_chat_with_llm_stream(
    request_id: String,
    base_url: String,
    api_key: Option<String>,
    model: String,
    messages: Vec<LlmChatMessage>,
    use_responses_api: bool,
    on_event: Channel<LlmStreamEvent>,
) -> Result<(), String> {
    let path = if use_responses_api { "responses" } else { "chat/completions" };
    let endpoint = format!("{}/{}", base_url.trim_end_matches('/'), path);
    let url = reqwest::Url::parse(&endpoint).map_err(|_| "API 地址无效".to_string())?;
    if !matches!(url.scheme(), "https" | "http") {
        return Err("API 地址必须使用 HTTP 或 HTTPS".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("无法创建网络请求: {e}"))?;
    let body = if use_responses_api {
        serde_json::json!({ "model": model, "input": messages, "stream": true })
    } else {
        serde_json::json!({ "model": model, "messages": messages, "stream": true })
    };
    let mut request = client.post(url.clone())
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .body(body.to_string());
    if let Some(key) = api_key.as_ref().filter(|key| !key.trim().is_empty()) {
        request = request.bearer_auth(key.trim());
    }
    let mut response = request.send().map_err(|e| {
        if e.is_connect() || e.is_timeout() || e.is_request() {
            "网络请求失败，请检查网络连接或 API 地址".to_string()
        } else {
            format!("AI 请求失败: {e}")
        }
    })?;
    if !response.status().is_success() {
        let status = response.status();
        let detail = response.text().unwrap_or_default();
        if status.as_u16() != 401 && status.as_u16() != 403 {
            let fallback_body = if use_responses_api {
                serde_json::json!({ "model": model, "input": messages })
            } else {
                serde_json::json!({ "model": model, "messages": messages })
            };
            let mut fallback_request = client
                .post(url)
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(fallback_body.to_string());
            if let Some(key) = api_key.as_ref().filter(|key| !key.trim().is_empty()) {
                fallback_request = fallback_request.bearer_auth(key.trim());
            }
            let fallback_response = fallback_request.send().map_err(|error| format!("AI 请求失败: {error}"))?;
            if fallback_response.status().is_success() {
                let response_text = fallback_response.text().map_err(|error| format!("读取 AI 响应失败: {error}"))?;
                let payload = serde_json::from_str::<serde_json::Value>(&response_text)
                    .map_err(|error| format!("解析 AI 响应失败: {error}"))?;
                let content = completion_text(&payload).ok_or_else(|| "服务没有返回可显示的回复".to_string())?;
                let _ = on_event.send(LlmStreamEvent { kind: "delta".to_string(), content });
                let _ = on_event.send(LlmStreamEvent { kind: "done".to_string(), content: String::new() });
                return Ok(());
            }
        }
        return Err(if detail.is_empty() { format!("AI 请求失败（HTTP {status}）") } else { format!("AI 请求失败（HTTP {status}）：{detail}") });
    }

    let cancellation = Arc::new(AtomicBool::new(false));
    llm_stream_cancellations()
        .lock()
        .map_err(|_| "无法初始化停止生成状态".to_string())?
        .insert(request_id.clone(), cancellation.clone());

    let mut pending = Vec::<u8>::new();
    let mut raw_response = Vec::<u8>::new();
    let mut sent_delta = false;
    let mut bytes = [0; 4096];
    loop {
        if cancellation.load(Ordering::Relaxed) { break; }
        let count = match response.read(&mut bytes) {
            Ok(count) => count,
            Err(error) => {
                if let Ok(mut active) = llm_stream_cancellations().lock() { active.remove(&request_id); }
                return Err(format!("读取 AI 响应失败: {error}"));
            }
        };
        if count == 0 { break; }
        if cancellation.load(Ordering::Relaxed) { break; }
        raw_response.extend_from_slice(&bytes[..count]);
        pending.extend_from_slice(&bytes[..count]);
        while let Some(end) = pending.iter().position(|byte| *byte == b'\n') {
            let line_bytes: Vec<u8> = pending.drain(..=end).collect();
            let line = String::from_utf8_lossy(&line_bytes).trim().to_string();
            let Some(data) = line.strip_prefix("data:") else { continue; };
            let data = data.trim();
            if data == "[DONE]" { continue; }
            if let Ok(payload) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = stream_delta(&payload) {
                    let _ = on_event.send(LlmStreamEvent { kind: "delta".to_string(), content: delta });
                    sent_delta = true;
                }
            }
        }
    }
    if !sent_delta && !cancellation.load(Ordering::Relaxed) {
        if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&raw_response) {
            if let Some(content) = completion_text(&payload) {
                let _ = on_event.send(LlmStreamEvent { kind: "delta".to_string(), content });
            }
        }
    }
    if let Ok(mut active) = llm_stream_cancellations().lock() { active.remove(&request_id); }
    let _ = on_event.send(LlmStreamEvent { kind: "done".to_string(), content: String::new() });
    Ok(())
}

#[tauri::command]
async fn chat_with_llm_stream(
    request_id: String,
    base_url: String,
    api_key: Option<String>,
    model: String,
    messages: Vec<LlmChatMessage>,
    use_responses_api: bool,
    on_event: Channel<LlmStreamEvent>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_chat_with_llm_stream(
            request_id,
            base_url,
            api_key,
            model,
            messages,
            use_responses_api,
            on_event,
        )
    })
    .await
    .map_err(|error| format!("AI 后台任务失败: {error}"))?
}

#[tauri::command]
fn stop_llm_generation(request_id: String) -> Result<(), String> {
    let active = llm_stream_cancellations()
        .lock()
        .map_err(|_| "无法访问生成状态".to_string())?;
    if let Some(cancellation) = active.get(&request_id) {
        cancellation.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
fn chat_with_llm(
    base_url: String,
    api_key: Option<String>,
    model: String,
    messages: Vec<LlmChatMessage>,
    use_responses_api: bool,
) -> Result<String, String> {
    let path = if use_responses_api { "responses" } else { "chat/completions" };
    let endpoint = format!("{}/{}", base_url.trim_end_matches('/'), path);
    let url = reqwest::Url::parse(&endpoint).map_err(|_| "API 地址无效".to_string())?;
    if !matches!(url.scheme(), "https" | "http") {
        return Err("API 地址必须使用 HTTP 或 HTTPS".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("无法创建网络请求: {e}"))?;
    let body = if use_responses_api {
        serde_json::json!({ "model": model, "input": messages })
    } else {
        serde_json::json!({ "model": model, "messages": messages, "stream": false })
    };
    let mut request = client
        .post(url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(body.to_string());
    if let Some(key) = api_key.filter(|key| !key.trim().is_empty()) {
        request = request.bearer_auth(key.trim());
    }
    let response = request.send().map_err(|e| {
        if e.is_connect() || e.is_timeout() || e.is_request() {
            "网络请求失败，请检查网络连接或 API 地址".to_string()
        } else {
            format!("AI 请求失败: {e}")
        }
    })?;
    if !response.status().is_success() {
        let status = response.status();
        let detail = response.text().unwrap_or_default();
        return Err(if detail.is_empty() {
            format!("AI 请求失败（HTTP {status}）")
        } else {
            format!("AI 请求失败（HTTP {status}）：{detail}")
        });
    }
    response.text().map_err(|e| format!("读取 AI 响应失败: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_dir,
            get_backup_stats,
            create_backup,
            get_git_status,
            git_pull,
            git_sync_push,
            get_file_diff,
            revert_file_change,
            download_release_asset,
            fetch_llm_models,
            chat_with_llm,
            chat_with_llm_stream,
            stop_llm_generation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
