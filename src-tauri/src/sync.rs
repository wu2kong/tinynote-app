use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitChangedFile {
    pub path: String,
    pub change_type: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoteInfo {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncStatus {
    pub is_repo: bool,
    pub remotes: Vec<GitRemoteInfo>,
    pub remote_url: Option<String>,
    pub primary_remote: Option<String>,
    pub branch: Option<String>,
    pub changed_md_count: u32,
    pub changed_files: Vec<GitChangedFile>,
    pub ahead: u32,
    pub behind: u32,
    pub has_remote: bool,
    pub hostname: String,
    pub status_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub diff: String,
    pub change_type: String,
    pub is_new_file: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInitResult {
    pub created: bool,
    pub branch: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPushRemoteResult {
    pub remote: String,
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPushResult {
    pub message: String,
    pub results: Vec<GitPushRemoteResult>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPullResult {
    pub conflict_copies: Vec<String>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitAuthPayload {
    pub username: String,
    pub password: String,
}

const TINYNOTE_GITIGNORE: &str = ".DS_Store\nThumbs.db\ndesktop.ini\n*.swp\n*~\n.idea/\n**/.tinynotes/configs.json\n**/.tinynotes/configs.jsonc\n";


fn configure_hidden_process(cmd: &mut Command) {
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

fn trim_hostname(name: String) -> Option<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn read_command_hostname(program: &str, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    configure_hidden_process(&mut cmd);
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    trim_hostname(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn get_hostname() -> String {
    #[cfg(windows)]
    {
        if let Ok(name) = std::env::var("COMPUTERNAME") {
            if let Some(trimmed) = trim_hostname(name) {
                return trimmed;
            }
        }
    }

    if let Ok(name) = std::env::var("HOSTNAME") {
        if let Some(trimmed) = trim_hostname(name) {
            return trimmed;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(name) = read_command_hostname("scutil", &["--get", "LocalHostName"]) {
            return name;
        }
        if let Some(name) = read_command_hostname("scutil", &["--get", "ComputerName"]) {
            return name;
        }
    }

    if let Some(name) = read_command_hostname("hostname", &[]) {
        return name;
    }

    "unknown".to_string()
}

fn git_command() -> Command {
    let mut cmd = Command::new(resolve_git_binary());
    configure_hidden_process(&mut cmd);
    cmd
}

fn resolve_git_binary() -> PathBuf {
    for candidate in ["/opt/homebrew/bin/git", "/usr/local/bin/git", "/usr/bin/git"] {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            return path;
        }
    }
    PathBuf::from("git")
}

fn find_git_root(start: &Path) -> Option<PathBuf> {
    let output = git_command()
        .args(["-C", &start.to_string_lossy(), "rev-parse", "--show-toplevel"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if root.is_empty() {
        None
    } else {
        Some(PathBuf::from(root))
    }
}

fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = run_git_output(repo_path, args)?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        git_error_message(&output)
    }
}

fn run_git_raw(repo_path: &str, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = run_git_output(repo_path, args)?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        git_error_message(&output).map(|_| Vec::new())
    }
}

fn run_git_output(repo_path: &str, args: &[&str]) -> Result<Output, String> {
    git_command()
        .arg("-c")
        .arg("core.quotepath=false")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("无法执行 git：{e}"))
}

const GIT_NETWORK_TIMEOUT_SECS: u64 = 60;

fn run_git_with_timeout(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let mut child = git_command()
        .arg("-c")
        .arg("core.quotepath=false")
        .args(args)
        .current_dir(repo_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never")
        .spawn()
        .map_err(|e| format!("无法执行 git：{e}"))?;

    let timeout = Duration::from_secs(GIT_NETWORK_TIMEOUT_SECS);
    let start = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut stdout = Vec::new();
                let mut stderr = Vec::new();
                if let Some(mut out) = child.stdout.take() {
                    out.read_to_end(&mut stdout).ok();
                }
                if let Some(mut err) = child.stderr.take() {
                    err.read_to_end(&mut stderr).ok();
                }
                let output = Output {
                    status,
                    stdout,
                    stderr,
                };
                if output.status.success() {
                    return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
                }
                return git_error_message(&output);
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "Git 操作超时（{GIT_NETWORK_TIMEOUT_SECS} 秒），请检查网络连接是否正常"
                    ));
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(e) => return Err(format!("无法执行 git：{e}")),
        }
    }
}

fn git_error_message(output: &std::process::Output) -> Result<String, String> {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let msg = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        "git 命令执行失败".to_string()
    };
    Err(msg)
}

fn run_git_diff(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = run_git_output(repo_path, args)?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if output.status.success() || output.status.code() == Some(1) {
        Ok(stdout)
    } else {
        git_error_message(&output)
    }
}

fn run_git_timeout_args(repo_path: &str, args: &[String]) -> Result<String, String> {
    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    run_git_with_timeout(repo_path, &borrowed)
}

fn resolve_repo_path(storage_path: &str) -> Result<String, String> {
    find_git_root(Path::new(storage_path))
        .ok_or_else(|| "当前笔记库还没有完成同步初始化。".to_string())
        .map(|p| p.to_string_lossy().into_owned())
}

fn resolve_repo_relative_path(repo_root: &Path, file_path: &str) -> Result<PathBuf, String> {
    if file_path.is_empty() {
        return Err("文件路径无效".to_string());
    }
    let candidate = Path::new(file_path);
    if candidate.is_absolute() {
        return Err("不允许使用绝对路径".to_string());
    }
    for component in candidate.components() {
        match component {
            std::path::Component::Normal(_) | std::path::Component::CurDir => {}
            _ => return Err("文件路径包含非法分量".to_string()),
        }
    }

    let full = repo_root.join(candidate);
    let canonical_root = repo_root
        .canonicalize()
        .map_err(|e| format!("无法解析仓库路径：{e}"))?;
    let canonical_full = if full.exists() {
        full.canonicalize()
            .map_err(|e| format!("无法解析文件路径：{e}"))?
    } else {
        let parent = full.parent().ok_or_else(|| "文件路径无效".to_string())?;
        let file_name = full.file_name().ok_or_else(|| "文件路径无效".to_string())?;
        if !parent.exists() {
            return Err("文件路径超出仓库范围".to_string());
        }
        parent
            .canonicalize()
            .map_err(|e| format!("无法解析文件路径：{e}"))?
            .join(file_name)
    };

    if !canonical_full.starts_with(&canonical_root) {
        return Err("文件路径超出仓库范围".to_string());
    }
    Ok(full)
}

fn strip_git_quotes(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"') {
        trimmed[1..trimmed.len() - 1]
            .replace("\\\"", "\"")
            .replace("\\\\", "\\")
    } else {
        trimmed.to_string()
    }
}

fn is_md_file(path: &str) -> bool {
    let normalized = strip_git_quotes(path);
    normalized
        .rsplit('/')
        .next()
        .map(|name| name.to_ascii_lowercase().ends_with(".md"))
        .unwrap_or(false)
}

fn collect_name_only_paths(repo_path: &str, args: &[&str]) -> Result<Vec<String>, String> {
    let output = run_git(repo_path, args)?;
    Ok(output
        .lines()
        .map(strip_git_quotes)
        .filter(|path| !path.is_empty())
        .collect())
}

fn collect_changed_md_files(repo_path: &str) -> Result<Vec<GitChangedFile>, String> {
    let untracked: HashSet<String> = collect_name_only_paths(
        repo_path,
        &["ls-files", "--others", "--exclude-standard"],
    )?
    .into_iter()
    .filter(|path| is_md_file(path))
    .collect();

    let unstaged: HashSet<String> = collect_name_only_paths(repo_path, &["diff", "--name-only"])?
        .into_iter()
        .filter(|path| is_md_file(path))
        .collect();

    let staged: HashSet<String> =
        collect_name_only_paths(repo_path, &["diff", "--cached", "--name-only"])?
            .into_iter()
            .filter(|path| is_md_file(path))
            .collect();

    let deleted_unstaged: HashSet<String> =
        collect_name_only_paths(repo_path, &["diff", "--name-only", "--diff-filter=D"])?
            .into_iter()
            .filter(|path| is_md_file(path))
            .collect();

    let deleted_staged: HashSet<String> = collect_name_only_paths(
        repo_path,
        &["diff", "--cached", "--name-only", "--diff-filter=D"],
    )?
    .into_iter()
    .filter(|path| is_md_file(path))
    .collect();

    let deleted: HashSet<String> = deleted_unstaged
        .union(&deleted_staged)
        .cloned()
        .collect();

    let mut all_paths: Vec<String> = untracked
        .iter()
        .chain(deleted.iter())
        .chain(staged.iter())
        .chain(unstaged.iter())
        .cloned()
        .collect();
    all_paths.sort();
    all_paths.dedup();

    Ok(all_paths
        .into_iter()
        .map(|path| {
            let change_type = if deleted.contains(&path) {
                "deleted".to_string()
            } else if untracked.contains(&path) {
                "added".to_string()
            } else {
                "modified".to_string()
            };
            GitChangedFile { path, change_type }
        })
        .collect())
}

fn is_deleted_file(repo_path: &str, file_path: &str) -> Result<bool, String> {
    for args in [
        &["diff", "--name-only", "--diff-filter=D"][..],
        &["diff", "--cached", "--name-only", "--diff-filter=D"][..],
    ] {
        let paths = collect_name_only_paths(repo_path, args)?;
        if paths.iter().any(|p| p == file_path) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn is_untracked_file(repo_path: &str, file_path: &str) -> Result<bool, String> {
    let untracked = collect_name_only_paths(repo_path, &["ls-files", "--others", "--exclude-standard"])?;
    Ok(untracked.iter().any(|p| p == file_path))
}

fn parse_ahead_behind_from_header(first_line: &str) -> (u32, u32) {
    let mut ahead = 0u32;
    let mut behind = 0u32;
    if let Some(rest) = first_line.find('[').map(|i| &first_line[i + 1..]) {
        let rest = rest.trim_end_matches(']');
        for part in rest.split(',') {
            let part = part.trim();
            if let Some(n) = part.strip_prefix("ahead ") {
                ahead = n.trim().parse().unwrap_or(0);
            } else if let Some(n) = part.strip_prefix("behind ") {
                behind = n.trim().parse().unwrap_or(0);
            }
        }
    }
    (ahead, behind)
}

fn parse_branch_from_header(first_line: &str) -> Option<String> {
    if !first_line.starts_with("## ") {
        return None;
    }
    let rest = first_line[3..].trim();
    if rest.is_empty() || rest == "HEAD (no branch)" {
        return None;
    }
    let branch = rest
        .split("...")
        .next()
        .unwrap_or(rest)
        .split_whitespace()
        .next()
        .unwrap_or(rest)
        .trim();
    if branch.is_empty() {
        None
    } else {
        Some(branch.to_string())
    }
}

fn porcelain_change_type(index_status: char, worktree_status: char) -> Option<&'static str> {
    if index_status == '?' && worktree_status == '?' {
        return Some("added");
    }
    if index_status == 'D' || worktree_status == 'D' {
        return Some("deleted");
    }
    if index_status != ' ' || worktree_status != ' ' {
        return Some("modified");
    }
    None
}

fn parse_status_snapshot(output: &str) -> (Option<String>, u32, u32, Vec<GitChangedFile>) {
    let mut lines = output.lines();
    let header = lines.next().unwrap_or("");
    let branch = parse_branch_from_header(header);
    let (ahead, behind) = parse_ahead_behind_from_header(header);

    let mut files = Vec::new();
    for line in lines {
        if line.len() < 4 {
            continue;
        }
        let statuses: Vec<char> = line.chars().take(2).collect();
        if statuses.len() < 2 {
            continue;
        }
        let path = strip_git_quotes(line[3..].trim());
        if path.is_empty() || !is_md_file(&path) {
            continue;
        }
        let Some(change_type) = porcelain_change_type(statuses[0], statuses[1]) else {
            continue;
        };
        files.push(GitChangedFile {
            path,
            change_type: change_type.to_string(),
        });
    }

    files.sort_by(|a, b| a.path.cmp(&b.path));
    files.dedup_by(|a, b| a.path == b.path);
    (branch, ahead, behind, files)
}

fn collect_status_snapshot(repo_path: &str) -> Result<(Option<String>, u32, u32, Vec<GitChangedFile>), String> {
    let output = run_git(
        repo_path,
        &["status", "-sb", "--porcelain", "-u", "--no-renames"],
    )?;
    Ok(parse_status_snapshot(&output))
}

fn empty_status(hostname: String, error: Option<String>) -> GitSyncStatus {
    GitSyncStatus {
        is_repo: false,
        remotes: Vec::new(),
        remote_url: None,
        primary_remote: None,
        branch: None,
        changed_md_count: 0,
        changed_files: Vec::new(),
        ahead: 0,
        behind: 0,
        has_remote: false,
        hostname,
        status_error: error,
    }
}

fn list_remotes_in_repo(repo_path: &str) -> Result<Vec<GitRemoteInfo>, String> {
    let output = run_git(repo_path, &["remote", "-v"]).unwrap_or_default();
    let mut seen = HashSet::new();
    let mut remotes = Vec::new();
    for line in output.lines() {
        let mut parts = line.split_whitespace();
        let name = parts.next().unwrap_or("");
        let url = parts.next().unwrap_or("");
        if name.is_empty() || url.is_empty() || !seen.insert(name.to_string()) {
            continue;
        }
        remotes.push(GitRemoteInfo {
            name: name.to_string(),
            url: url.to_string(),
        });
    }
    Ok(remotes)
}

fn pick_primary_remote<'a>(
    remotes: &'a [GitRemoteInfo],
    primary_remote: Option<&str>,
) -> Option<&'a GitRemoteInfo> {
    if let Some(name) = primary_remote.filter(|value| !value.is_empty()) {
        if let Some(found) = remotes.iter().find(|remote| remote.name == name) {
            return Some(found);
        }
    }
    remotes
        .iter()
        .find(|remote| remote.name == "origin")
        .or_else(|| remotes.first())
}

fn current_branch(repo_path: &str) -> Option<String> {
    run_git(repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .filter(|value| !value.is_empty() && value != "HEAD")
}

fn to_https_remote_url(url: &str) -> Result<String, String> {
    let value = url.trim();
    if value.starts_with("https://") || value.starts_with("http://") {
        return Ok(value.to_string());
    }
    if let Some(rest) = value.strip_prefix("git@") {
        if let Some((host, path)) = rest.split_once(':') {
            return Ok(format!("https://{host}/{}", path.trim_start_matches('/')));
        }
    }
    if let Some(rest) = value.strip_prefix("ssh://") {
        let rest = rest.trim_start_matches("git@");
        return Ok(format!("https://{rest}"));
    }
    Err(format!("不支持的远程地址：{url}"))
}

fn embed_credentials(url: &str, auth: &GitAuthPayload) -> Result<String, String> {
    let https = to_https_remote_url(url)?;
    let mut parsed = reqwest::Url::parse(&https).map_err(|_| "远程地址无效".to_string())?;
    parsed
        .set_username(&auth.username)
        .map_err(|_| "无法写入用户名".to_string())?;
    parsed
        .set_password(Some(&auth.password))
        .map_err(|_| "无法写入凭据".to_string())?;
    Ok(parsed.to_string())
}

fn ensure_gitignore(storage: &Path) {
    let path = storage.join(".gitignore");
    if path.exists() {
        return;
    }
    let _ = std::fs::write(path, TINYNOTE_GITIGNORE);
}

pub fn get_git_status(
    storage_path: &str,
    primary_remote: Option<&str>,
) -> Result<GitSyncStatus, String> {
    let hostname = get_hostname();
    let storage = Path::new(storage_path);

    if !storage.is_dir() {
        return Ok(empty_status(
            hostname,
            Some("笔记库目录不存在".to_string()),
        ));
    }

    let Some(git_root) = find_git_root(storage) else {
        return Ok(empty_status(hostname, None));
    };

    let repo_path = git_root.to_string_lossy().into_owned();
    let remotes = list_remotes_in_repo(&repo_path).unwrap_or_default();
    let origin = pick_primary_remote(&remotes, primary_remote);
    let remote_url = origin.map(|remote| remote.url.clone());
    let primary = origin.map(|remote| remote.name.clone());
    let has_remote = !remotes.is_empty();

    let (branch, ahead, behind, changed_files, status_error) =
        match collect_status_snapshot(&repo_path) {
            Ok((status_branch, ahead, behind, files)) => {
                let branch = status_branch.or_else(|| current_branch(&repo_path));
                (branch, ahead, behind, files, None)
            }
            Err(err) => (None, 0, 0, Vec::new(), Some(err)),
        };

    Ok(GitSyncStatus {
        is_repo: true,
        remotes,
        remote_url,
        primary_remote: primary,
        branch,
        changed_md_count: changed_files.len() as u32,
        changed_files,
        ahead,
        behind,
        has_remote,
        hostname,
        status_error,
    })
}

pub fn git_init(storage_path: &str) -> Result<GitInitResult, String> {
    let storage = Path::new(storage_path);
    if !storage.is_dir() {
        return Err("笔记库目录不存在".to_string());
    }

    if let Some(root) = find_git_root(storage) {
        let repo_path = root.to_string_lossy().into_owned();
        return Ok(GitInitResult {
            created: false,
            branch: current_branch(&repo_path).unwrap_or_else(|| "main".to_string()),
        });
    }

    let repo_path = storage.to_string_lossy().into_owned();
    if run_git(&repo_path, &["init", "-b", "main"]).is_err() {
        run_git(&repo_path, &["init"])?;
        let _ = run_git(&repo_path, &["symbolic-ref", "HEAD", "refs/heads/main"]);
    }
    let _ = run_git(&repo_path, &["config", "user.name", "TinyNote"]);
    let _ = run_git(&repo_path, &["config", "user.email", "tinynote@local"]);
    ensure_gitignore(storage);
    let _ = run_git(&repo_path, &["add", "--", ".gitignore"]);
    let _ = run_git(
        &repo_path,
        &["commit", "-m", "Initialize TinyNote library"],
    );
    Ok(GitInitResult {
        created: true,
        branch: "main".to_string(),
    })
}

pub fn git_list_remotes(storage_path: &str) -> Result<Vec<GitRemoteInfo>, String> {
    let repo_path = resolve_repo_path(storage_path)?;
    list_remotes_in_repo(&repo_path)
}

pub fn git_add_remote(storage_path: &str, name: &str, url: &str) -> Result<(), String> {
    let repo_path = resolve_repo_path(storage_path)?;
    if run_git(&repo_path, &["remote", "get-url", name]).is_ok() {
        run_git(&repo_path, &["remote", "set-url", name, url]).map(|_| ())
    } else {
        run_git(&repo_path, &["remote", "add", name, url]).map(|_| ())
    }
}

pub fn git_remove_remote(storage_path: &str, name: &str) -> Result<(), String> {
    let repo_path = resolve_repo_path(storage_path)?;
    run_git(&repo_path, &["remote", "remove", name]).map(|_| ())
}

fn with_conflict_copy_count(suffix: &str, n: usize) -> String {
    if n <= 1 {
        return suffix.to_string();
    }
    if let Some(rest) = suffix.strip_suffix('）') {
        format!("{rest} {n}）")
    } else if let Some(rest) = suffix.strip_suffix(')') {
        format!("{rest} {n})")
    } else {
        format!("{suffix} {n}")
    }
}

fn allocate_conflict_copy_path(repo: &Path, relative: &str, suffix: &str) -> Result<String, String> {
    let normalized = relative.replace('\\', "/");
    let (dir, base) = match normalized.rfind('/') {
        Some(index) => (&normalized[..=index], &normalized[index + 1..]),
        None => ("", normalized.as_str()),
    };
    let (stem, ext) = match base.rfind('.') {
        Some(index) if index > 0 && index + 1 < base.len() => (&base[..index], &base[index..]),
        _ => (base, ""),
    };
    for n in 1..=99 {
        let candidate = format!("{dir}{stem}{}{ext}", with_conflict_copy_count(suffix, n));
        if !repo_join(repo, &candidate).exists() {
            return Ok(candidate);
        }
    }
    Err("无法创建冲突副本文件".to_string())
}

fn repo_join(repo: &Path, relative: &str) -> PathBuf {
    let mut path = repo.to_path_buf();
    for part in relative.replace('\\', "/").split('/') {
        if !part.is_empty() && part != "." {
            path.push(part);
        }
    }
    path
}

fn read_git_blob(repo_path: &str, spec: &str) -> Option<Vec<u8>> {
    run_git_raw(repo_path, &["show", spec]).ok()
}

fn write_conflict_copy(
    repo_path: &str,
    original: &str,
    content: &[u8],
    suffix: &str,
    copies: &mut Vec<String>,
) -> Result<(), String> {
    if original.is_empty() || original == ".git" || original.starts_with(".git/") {
        return Ok(());
    }
    let repo = Path::new(repo_path);
    let copy_path = allocate_conflict_copy_path(repo, original, suffix)?;
    let full = repo_join(repo, &copy_path);
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("无法创建冲突副本目录：{e}"))?;
    }
    std::fs::write(&full, content).map_err(|e| format!("无法写入冲突副本：{e}"))?;
    copies.push(copy_path);
    Ok(())
}

fn has_head(repo_path: &str) -> bool {
    run_git(repo_path, &["rev-parse", "--verify", "HEAD"]).is_ok()
}

fn merge_in_progress(repo_path: &str) -> bool {
    run_git(repo_path, &["rev-parse", "-q", "--verify", "MERGE_HEAD"]).is_ok()
}

fn is_merge_conflict_message(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("conflict")
        || lower.contains("fix conflicts")
        || lower.contains("automatic merge failed")
        || message.contains("冲突")
}

fn is_overwrite_message(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("would be overwritten")
        || lower.contains("please commit your changes")
        || lower.contains("uncommitted changes")
        || message.contains("将会被覆盖")
}

fn list_unmerged_paths(repo_path: &str) -> Result<Vec<String>, String> {
    collect_name_only_paths(repo_path, &["diff", "--name-only", "--diff-filter=U"])
}

fn list_dirty_paths(repo_path: &str) -> Result<HashSet<String>, String> {
    let mut paths = HashSet::new();
    for args in [
        &["diff", "--name-only"][..],
        &["diff", "--cached", "--name-only"][..],
        &["ls-files", "--others", "--exclude-standard"][..],
    ] {
        for path in collect_name_only_paths(repo_path, args)? {
            paths.insert(path);
        }
    }
    Ok(paths)
}

fn protect_dirty_files(
    repo_path: &str,
    suffix: &str,
    copies: &mut Vec<String>,
) -> Result<(), String> {
    if !has_head(repo_path) {
        return Ok(());
    }
    let incoming: HashSet<String> =
        collect_name_only_paths(repo_path, &["diff", "--name-only", "HEAD", "FETCH_HEAD"])?
            .into_iter()
            .collect();
    if incoming.is_empty() {
        return Ok(());
    }
    for path in list_dirty_paths(repo_path)? {
        if !incoming.contains(&path) {
            continue;
        }
        let work_path = repo_join(Path::new(repo_path), &path);
        let work = if work_path.is_file() {
            std::fs::read(&work_path).ok()
        } else {
            None
        };
        let theirs = read_git_blob(repo_path, &format!("FETCH_HEAD:{path}"));
        if let (Some(work_bytes), Some(their_bytes)) = (work.as_ref(), theirs.as_ref()) {
            if work_bytes != their_bytes {
                write_conflict_copy(repo_path, &path, work_bytes, suffix, copies)?;
            }
        } else if let Some(work_bytes) = work.as_ref() {
            write_conflict_copy(repo_path, &path, work_bytes, suffix, copies)?;
        }
        if work_path.is_file() && read_git_blob(repo_path, &format!("HEAD:{path}")).is_none() {
            let _ = std::fs::remove_file(&work_path);
        } else {
            let _ = run_git(repo_path, &["checkout", "--", &path]);
        }
    }
    Ok(())
}

fn unmerged_has_stage(repo_path: &str, path: &str, stage: &str) -> bool {
    read_git_blob(repo_path, &format!(":{stage}:{path}")).is_some()
}

fn resolve_merge_conflicts(
    repo_path: &str,
    suffix: &str,
    copies: &mut Vec<String>,
) -> Result<(), String> {
    for path in list_unmerged_paths(repo_path)? {
        let ours = read_git_blob(repo_path, &format!(":2:{path}"));
        let theirs = read_git_blob(repo_path, &format!(":3:{path}"));
        let has_ours = ours.is_some() || unmerged_has_stage(repo_path, &path, "2");
        let has_theirs = theirs.is_some() || unmerged_has_stage(repo_path, &path, "3");

        if has_ours && has_theirs {
            if let (Some(ours_bytes), Some(theirs_bytes)) = (ours.as_ref(), theirs.as_ref()) {
                if ours_bytes != theirs_bytes {
                    write_conflict_copy(repo_path, &path, ours_bytes, suffix, copies)?;
                }
                let full = repo_join(Path::new(repo_path), &path);
                if let Some(parent) = full.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("无法写入远程版本：{e}"))?;
                }
                std::fs::write(&full, theirs_bytes)
                    .map_err(|e| format!("无法写入远程版本：{e}"))?;
                run_git(repo_path, &["add", "--", &path])?;
            }
        } else if has_theirs {
            let _ = run_git(repo_path, &["checkout", "--theirs", "--", &path]);
            run_git(repo_path, &["add", "--", &path])?;
        } else if has_ours {
            if let Some(ours_bytes) = ours.as_ref() {
                write_conflict_copy(repo_path, &path, ours_bytes, suffix, copies)?;
            }
            let _ = run_git(repo_path, &["rm", "-f", "--", &path]);
        }
    }
    Ok(())
}

fn commit_conflict_copies(repo_path: &str, copies: &[String]) -> Result<(), String> {
    for path in copies {
        let _ = run_git(repo_path, &["add", "--", path]);
    }
    if merge_in_progress(repo_path) {
        run_git(repo_path, &["commit", "--no-edit"]).map(|_| ())?;
        return Ok(());
    }
    if copies.is_empty() {
        return Ok(());
    }
    let staged = run_git(repo_path, &["diff", "--cached", "--name-only"]).unwrap_or_default();
    if staged.is_empty() {
        return Ok(());
    }
    run_git(
        repo_path,
        &["commit", "-m", "Keep local notes from sync conflict"],
    )
    .map(|_| ())
}

fn merge_fetch_head(repo_path: &str, allow_unrelated: bool) -> Result<(), String> {
    let mut args = vec!["merge".to_string(), "--no-edit".to_string()];
    if allow_unrelated {
        args.insert(1, "--allow-unrelated-histories".to_string());
    }
    args.push("FETCH_HEAD".to_string());
    run_git_timeout_args(repo_path, &args).map(|_| ())
}

pub fn git_pull(
    storage_path: &str,
    remote: Option<&str>,
    auth: Option<&GitAuthPayload>,
    allow_unrelated: bool,
    conflict_copy_suffix: Option<&str>,
) -> Result<GitPullResult, String> {
    let repo_path = resolve_repo_path(storage_path)?;
    let remotes = list_remotes_in_repo(&repo_path)?;
    let target = pick_primary_remote(&remotes, remote)
        .ok_or_else(|| "还没有配置同步源".to_string())?;
    let branch = current_branch(&repo_path).unwrap_or_else(|| "main".to_string());
    let suffix = conflict_copy_suffix
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("（冲突版本）")
        .to_string();
    let mut copies = Vec::new();

    if merge_in_progress(&repo_path) {
        resolve_merge_conflicts(&repo_path, &suffix, &mut copies)?;
        commit_conflict_copies(&repo_path, &copies)?;
    }

    let mut fetch_args = vec!["fetch".to_string()];
    if let Some(auth) = auth {
        fetch_args.push(embed_credentials(&target.url, auth)?);
    } else {
        fetch_args.push(target.name.clone());
    }
    fetch_args.push(branch);
    run_git_timeout_args(&repo_path, &fetch_args)?;

    protect_dirty_files(&repo_path, &suffix, &mut copies)?;

    match merge_fetch_head(&repo_path, allow_unrelated) {
        Ok(()) => {}
        Err(error) if is_overwrite_message(&error) => {
            protect_dirty_files(&repo_path, &suffix, &mut copies)?;
            match merge_fetch_head(&repo_path, allow_unrelated) {
                Ok(()) => {}
                Err(retry_error) if is_merge_conflict_message(&retry_error) => {
                    resolve_merge_conflicts(&repo_path, &suffix, &mut copies)?;
                }
                Err(retry_error) => return Err(retry_error),
            }
        }
        Err(error) if is_merge_conflict_message(&error) => {
            resolve_merge_conflicts(&repo_path, &suffix, &mut copies)?;
        }
        Err(error) => return Err(error),
    }

    if merge_in_progress(&repo_path) {
        let leftover = list_unmerged_paths(&repo_path)?;
        if !leftover.is_empty() {
            return Err("笔记冲突无法自动处理，请先备份笔记库后再试。".to_string());
        }
    }

    commit_conflict_copies(&repo_path, &copies)?;
    copies.sort();
    copies.dedup();
    Ok(GitPullResult {
        conflict_copies: copies,
    })
}

pub fn git_sync_push(
    storage_path: &str,
    remotes: Option<Vec<String>>,
    auth_by_remote: Option<HashMap<String, GitAuthPayload>>,
) -> Result<GitPushResult, String> {
    let repo_path = resolve_repo_path(storage_path)?;
    let hostname = get_hostname();
    let message = format!("{hostname} sync push");

    let changed_files = collect_changed_md_files(&repo_path)?;
    if !changed_files.is_empty() {
        for file in &changed_files {
            run_git(&repo_path, &["add", "--", &file.path])?;
        }
        let staged = run_git(&repo_path, &["diff", "--cached", "--name-only"]).unwrap_or_default();
        if !staged.is_empty() {
            run_git(&repo_path, &["commit", "-m", &message])?;
        }
    }

    let remotes_info = list_remotes_in_repo(&repo_path)?;
    let targets = remotes.unwrap_or_else(|| {
        remotes_info
            .iter()
            .map(|remote| remote.name.clone())
            .collect()
    });
    if targets.is_empty() {
        return Err("还没有配置同步源".to_string());
    }

    let branch = current_branch(&repo_path).unwrap_or_else(|| "main".to_string());
    let mut results = Vec::new();
    for name in targets {
        let Some(info) = remotes_info.iter().find(|remote| remote.name == name) else {
            results.push(GitPushRemoteResult {
                remote: name,
                ok: false,
                error: Some("找不到这个同步源".to_string()),
            });
            continue;
        };
        let mut args = vec!["push".to_string(), "-u".to_string()];
        if let Some(auth) = auth_by_remote.as_ref().and_then(|map| map.get(&name)) {
            match embed_credentials(&info.url, auth) {
                Ok(auth_url) => {
                    args.push(auth_url);
                    args.push(format!("HEAD:{branch}"));
                }
                Err(error) => {
                    results.push(GitPushRemoteResult {
                        remote: name,
                        ok: false,
                        error: Some(error),
                    });
                    continue;
                }
            }
        } else {
            args.push(name.clone());
            args.push(format!("HEAD:{branch}"));
        }
        match run_git_timeout_args(&repo_path, &args) {
            Ok(_) => results.push(GitPushRemoteResult {
                remote: name,
                ok: true,
                error: None,
            }),
            Err(error) => results.push(GitPushRemoteResult {
                remote: name,
                ok: false,
                error: Some(error),
            }),
        }
    }

    if results.iter().all(|item| !item.ok) && changed_files.is_empty() {
        if let Some(first_error) = results
            .iter()
            .find_map(|item| item.error.clone())
        {
            return Err(first_error);
        }
        return Err("没有需要提交的内容".to_string());
    }

    Ok(GitPushResult { message, results })
}

pub fn git_http_request(
    method: &str,
    url: &str,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<GitHttpResponse, String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| "请求地址无效".to_string())?;
    if !matches!(parsed.scheme(), "https" | "http") {
        return Err("仅支持 HTTP 或 HTTPS".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("无法创建网络请求: {e}"))?;

    let mut request = match method.to_ascii_uppercase().as_str() {
        "GET" => client.get(parsed),
        "POST" => client.post(parsed),
        "PUT" => client.put(parsed),
        "PATCH" => client.patch(parsed),
        _ => return Err("不支持的请求方法".to_string()),
    };

    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(key, value);
        }
    }
    if let Some(body) = body {
        request = request.body(body);
    }

    let response = request.send().map_err(|e| {
        if e.is_connect() || e.is_timeout() || e.is_request() {
            "网络请求失败，请检查网络连接".to_string()
        } else {
            format!("请求失败: {e}")
        }
    })?;
    Ok(GitHttpResponse {
        status: response.status().as_u16(),
        text: response.text().unwrap_or_default(),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHttpResponse {
    pub status: u16,
    pub text: String,
}

pub fn get_file_diff(storage_path: &str, file_path: &str) -> Result<FileDiff, String> {
    let repo_path = resolve_repo_path(storage_path)?;
    resolve_repo_relative_path(Path::new(&repo_path), file_path)?;
    let is_deleted = is_deleted_file(&repo_path, file_path)?;
    let is_new = !is_deleted && is_untracked_file(&repo_path, file_path)?;

    let diff = if is_deleted {
        let diff_output =
            run_git_diff(&repo_path, &["diff", "HEAD", "--", file_path]).unwrap_or_default();
        if diff_output.trim().is_empty() {
            deleted_file_preview(&repo_path, file_path)?
        } else {
            diff_output
        }
    } else if is_new {
        run_git_diff(
            &repo_path,
            &["diff", "--no-index", "--", "/dev/null", file_path],
        )
        .unwrap_or_default()
    } else {
        run_git_diff(&repo_path, &["diff", "HEAD", "--", file_path])?
    };

    let change_type = if is_deleted {
        "deleted".to_string()
    } else if is_new {
        "added".to_string()
    } else {
        "modified".to_string()
    };

    Ok(FileDiff {
        diff: if diff.trim().is_empty() && is_new {
            new_file_preview(&repo_path, file_path)?
        } else {
            diff
        },
        change_type,
        is_new_file: is_new,
    })
}

fn new_file_preview(repo_path: &str, file_path: &str) -> Result<String, String> {
    let full_path = resolve_repo_relative_path(Path::new(repo_path), file_path)?;
    let content = std::fs::read_to_string(&full_path).map_err(|e| e.to_string())?;
    Ok(content
        .lines()
        .map(|line| format!("+{line}"))
        .collect::<Vec<_>>()
        .join("\n"))
}

fn deleted_file_preview(repo_path: &str, file_path: &str) -> Result<String, String> {
    let content = run_git(&repo_path, &["show", &format!("HEAD:{file_path}")])?;
    Ok(content
        .lines()
        .map(|line| format!("-{line}"))
        .collect::<Vec<_>>()
        .join("\n"))
}

pub fn revert_file_change(storage_path: &str, file_path: &str) -> Result<(), String> {
    let repo_root = find_git_root(Path::new(storage_path))
        .ok_or_else(|| "当前笔记库还没有完成同步初始化。".to_string())?;
    resolve_repo_relative_path(&repo_root, file_path)?;
    let repo_path = repo_root.to_string_lossy().into_owned();

    if is_untracked_file(&repo_path, file_path)? {
        let full_path = resolve_repo_relative_path(&repo_root, file_path)?;
        if full_path.is_file() {
            std::fs::remove_file(&full_path).map_err(|e| format!("删除文件失败：{e}"))?;
        }
    } else if is_deleted_file(&repo_path, file_path)? {
        run_git(
            &repo_path,
            &[
                "restore",
                "--source=HEAD",
                "--staged",
                "--worktree",
                "--",
                file_path,
            ],
        )?;
    } else {
        run_git(
            &repo_path,
            &[
                "restore",
                "--source=HEAD",
                "--staged",
                "--worktree",
                "--",
                file_path,
            ],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_md_with_quoted_path() {
        assert!(is_md_file(
            "\"Api测试与开发.tinynotes/智星云Token API服务.md\""
        ));
    }

    #[test]
    fn detects_plain_md_path() {
        assert!(is_md_file("notes/foo.md"));
        assert!(!is_md_file("notes/foo.txt"));
    }

    #[test]
    fn parses_status_snapshot_with_branch_and_changes() {
        let output = "## main...origin/main [ahead 1, behind 2]\n M notes/a.md\n?? notes/b.md\n";
        let (branch, ahead, behind, files) = parse_status_snapshot(output);
        assert_eq!(branch.as_deref(), Some("main"));
        assert_eq!(ahead, 1);
        assert_eq!(behind, 2);
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].path, "notes/a.md");
        assert_eq!(files[0].change_type, "modified");
        assert_eq!(files[1].path, "notes/b.md");
        assert_eq!(files[1].change_type, "added");
    }

    #[test]
    fn hostname_is_not_empty() {
        let name = get_hostname();
        assert!(!name.is_empty());
    }

    #[test]
    fn rejects_path_escape_outside_repo() {
        let tmp = std::env::temp_dir().join(format!("tinynote-sync-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let result = resolve_repo_relative_path(&tmp, "../secret.txt");
        let _ = std::fs::remove_dir_all(&tmp);
        assert!(result.is_err());
    }
}
