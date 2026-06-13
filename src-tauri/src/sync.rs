use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;

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

fn get_hostname() -> String {
    if let Ok(output) = Command::new("hostname").output() {
        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !name.is_empty() {
            return name;
        }
    }
    "unknown".to_string()
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
    let output = Command::new(resolve_git_binary())
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

fn run_git_output(repo_path: &str, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new(resolve_git_binary())
        .arg("-c")
        .arg("core.quotepath=false")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("无法执行 git：{e}"))
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

fn parse_ahead_behind(repo_path: &str) -> (u32, u32) {
    let Ok(output) = run_git(repo_path, &["status", "-sb"]) else {
        return (0, 0);
    };
    let first_line = output.lines().next().unwrap_or("");
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
    let branch = run_git(&repo_path, &["rev-parse", "--abbrev-ref", "HEAD"]).ok();

    let (changed_files, status_error) = match collect_changed_md_files(&repo_path) {
        Ok(files) => (files, None),
        Err(err) => (Vec::new(), Some(err)),
    };
    let (ahead, behind) = parse_ahead_behind(&repo_path);

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
    run_git(&repo_path.to_string_lossy(), &["pull"]).map(|_| ())
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

    run_git(&repo_path, &["push"])?;
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
}
