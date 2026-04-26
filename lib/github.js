import { readFileSync } from 'fs';

const GITHUB_API = 'https://api.github.com';

async function apiCall(token, method, path, body) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }

  return res.status === 404 ? null : res.json();
}

export async function ensureRepoExists(token, owner, repo) {
  const existing = await apiCall(token, 'GET', `/repos/${owner}/${repo}`, null);
  if (existing) return existing;

  return apiCall(token, 'POST', '/user/repos', {
    name: repo,
    description: 'Brag documents — registro automático de entregas de valor por commit',
    private: false,
    auto_init: true,
  });
}

export async function pushFileToGitHub(token, owner, repo, filePath, content, commitMessage) {
  // Check if file exists to get its SHA
  const existing = await apiCall(token, 'GET', `/repos/${owner}/${repo}/contents/${filePath}`, null);
  const encoded = Buffer.from(content, 'utf8').toString('base64');

  const body = {
    message: commitMessage,
    content: encoded,
    ...(existing ? { sha: existing.sha } : {}),
  };

  return apiCall(token, 'PUT', `/repos/${owner}/${repo}/contents/${filePath}`, body);
}

export async function publishBragDoc(config, ticket, localFilePath) {
  const { githubToken, githubOwner, githubRepo } = config;
  if (!githubToken) throw new Error('GitHub token não configurado. Execute: brag config --token SEU_TOKEN');

  const content = readFileSync(localFilePath, 'utf8');
  const remotePath = `brag/${ticket}.md`;
  const message = `brag(${ticket}): atualiza documento de entrega`;

  await ensureRepoExists(githubToken, githubOwner, githubRepo);
  await pushFileToGitHub(githubToken, githubOwner, githubRepo, remotePath, content, message);

  return `https://github.com/${githubOwner}/${githubRepo}/blob/main/${remotePath}`;
}
