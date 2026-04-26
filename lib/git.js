import { execSync } from 'child_process';

export function getCurrentBranch(cwd = process.cwd()) {
  return execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
}

export function getLastCommit(cwd = process.cwd()) {
  const hash = execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
  const short = hash.slice(0, 8);
  const message = execSync('git log -1 --pretty=format:%s', { cwd, encoding: 'utf8' }).trim();
  const author = execSync('git log -1 --pretty=format:%an', { cwd, encoding: 'utf8' }).trim();
  const date = execSync('git log -1 --pretty=format:%ad --date=short', { cwd, encoding: 'utf8' }).trim();
  const body = execSync('git log -1 --pretty=format:%b', { cwd, encoding: 'utf8' }).trim();

  let stats = { files: 0, insertions: 0, deletions: 0, changedFiles: [] };
  try {
    const statRaw = execSync('git diff-tree --no-commit-id -r --stat HEAD', { cwd, encoding: 'utf8' }).trim();
    const lines = statRaw.split('\n');
    const summary = lines[lines.length - 1] || '';
    const filesMatch = summary.match(/(\d+) file/);
    const insertMatch = summary.match(/(\d+) insertion/);
    const deleteMatch = summary.match(/(\d+) deletion/);
    stats.files = filesMatch ? parseInt(filesMatch[1]) : 0;
    stats.insertions = insertMatch ? parseInt(insertMatch[1]) : 0;
    stats.deletions = deleteMatch ? parseInt(deleteMatch[1]) : 0;
    stats.changedFiles = lines.slice(0, -1).map(l => l.trim().split('|')[0].trim()).filter(Boolean);
  } catch {}

  let repoName = '';
  try {
    let remoteUrl = '';
    try {
      remoteUrl = execSync('git remote get-url origin', { cwd, encoding: 'utf8' }).trim();
    } catch {
      const remotes = execSync('git remote', { cwd, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      if (remotes.length > 0) {
        remoteUrl = execSync(`git remote get-url ${remotes[0]}`, { cwd, encoding: 'utf8' }).trim();
      }
    }
    if (remoteUrl) {
      repoName = remoteUrl.split('/').pop().replace(/\.git$/, '');
    } else {
      const repoRoot = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
      repoName = repoRoot.split('/').pop();
    }
  } catch {}

  return { hash, short, message, author, date, body, stats, repoName };
}

export function extractTicket(branch, pattern = /([A-Z]+-\d+)/) {
  const match = branch.match(pattern);
  return match ? match[1] : null;
}

export function isGitRepo(cwd = process.cwd()) {
  try {
    execSync('git rev-parse --git-dir', { cwd, encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
