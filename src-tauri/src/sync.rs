use serde::Serialize;
use std::collections::HashSet;
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
pub struct GitSyncStatus {
    pub is_repo: bool,
    pub remote_url: Option<String>,
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

fn resolve_repo_path(storage_path: &str) -> Result<String, String> {
    find_git_root(Path::new(storage_path))
        .ok_or_else(|| "当前笔记库目录不是 Git 仓库，请先在目录中初始化 Git。".to_string())
        .map(|p| p.to_string_lossy().into_owned())
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

pub fn get_git_status(storage_path: &str) -> Result<GitSyncStatus, String> {
    let hostname = get_hostname();
    let storage = Path::new(storage_path);

    if !storage.is_dir() {
        return Ok(GitSyncStatus {
            is_repo: false,
            remote_url: None,
            branch: None,
            changed_md_count: 0,
            changed_files: Vec::new(),
            ahead: 0,
            behind: 0,
            has_remote: false,
            hostname,
            status_error: Some("笔记库目录不存在".to_string()),
        });
    }

    let Some(git_root) = find_git_root(storage) else {
        return Ok(GitSyncStatus {
            is_repo: false,
            remote_url: None,
            branch: None,
            changed_md_count: 0,
            changed_files: Vec::new(),
            ahead: 0,
            behind: 0,
            has_remote: false,
            hostname,
            status_error: None,
        });
    };

    let repo_path = git_root.to_string_lossy().into_owned();

    let remote_url = run_git(&repo_path, &["remote", "get-url", "origin"])
        .ok()
        .filter(|s| !s.is_empty());
    let has_remote = remote_url.is_some();

    let (branch, ahead, behind, changed_files, status_error) =
        match collect_status_snapshot(&repo_path) {
            Ok((status_branch, ahead, behind, files)) => {
                let branch = status_branch.or_else(|| {
                    run_git(&repo_path, &["rev-parse", "--abbrev-ref", "HEAD"]).ok()
                });
                (branch, ahead, behind, files, None)
            }
            Err(err) => (None, 0, 0, Vec::new(), Some(err)),
        };

    Ok(GitSyncStatus {
        is_repo: true,
        remote_url,
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

pub fn git_pull(storage_path: &str) -> Result<(), String> {
    let repo_path = find_git_root(Path::new(storage_path))
        .ok_or_else(|| "当前笔记库目录不是 Git 仓库，请先在目录中初始化 Git。".to_string())?;
    run_git_with_timeout(&repo_path.to_string_lossy(), &["pull"]).map(|_| ())
}

pub fn git_sync_push(storage_path: &str) -> Result<String, String> {
    let repo_path = find_git_root(Path::new(storage_path))
        .ok_or_else(|| "当前笔记库目录不是 Git 仓库，请先在目录中初始化 Git。".to_string())?;
    let repo_path = repo_path.to_string_lossy().into_owned();

    let hostname = get_hostname();
    let message = format!("{hostname} sync push");

    let changed_files = collect_changed_md_files(&repo_path)?;
    if changed_files.is_empty() {
        return Err("没有需要提交的内容".to_string());
    }

    for file in &changed_files {
        run_git(&repo_path, &["add", "--", &file.path])?;
    }

    let staged = run_git(&repo_path, &["diff", "--cached", "--name-only"]).unwrap_or_default();
    if !staged.is_empty() {
        run_git(&repo_path, &["commit", "-m", &message])?;
    }

    run_git_with_timeout(&repo_path, &["push"])?;
    Ok(message)
}

pub fn get_file_diff(storage_path: &str, file_path: &str) -> Result<FileDiff, String> {
    let repo_path = resolve_repo_path(storage_path)?;
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
    let full_path = Path::new(repo_path).join(file_path);
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
        .ok_or_else(|| "当前笔记库目录不是 Git 仓库，请先在目录中初始化 Git。".to_string())?;
    let repo_path = repo_root.to_string_lossy().into_owned();

    if is_untracked_file(&repo_path, file_path)? {
        let full_path = repo_root.join(file_path);
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
    fn hostname_is_not_unknown() {
        let name = get_hostname();
        assert!(!name.is_empty());
        assert_ne!(name, "unknown");
    }
}
