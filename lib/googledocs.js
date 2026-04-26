import { createServer } from 'http';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { buildOrUpdateDocument } from './formatter.js';
import { getFolderLabel } from './folders.js';
import { saveConfig } from './config.js';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
].join(' ');

const INDEX_FILE = join(homedir(), '.brag', 'googledocs-index.json');

// ─── Index (ticket → { docId, folder }) ─────────────────────────────────────

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return {};
  try { return JSON.parse(readFileSync(INDEX_FILE, 'utf8')); } catch { return {}; }
}

function saveIndex(index) {
  mkdirSync(join(homedir(), '.brag'), { recursive: true });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function driveRequest(method, path, body, accessToken) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Drive API ${method} ${path}: ${err.error?.message || res.status}`);
  }
  return res.json();
}

async function docsRequest(method, path, body, accessToken) {
  const res = await fetch(`https://docs.googleapis.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Docs API ${method} ${path}: ${err.error?.message || res.status}`);
  }
  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getAccessToken(config) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: config.googleRefreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Falha ao renovar token Google: ${data.error_description || data.error}`);
  return data.access_token;
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === 'darwin') execSync(`open "${url}"`);
    else if (platform === 'win32') execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {}
}

export async function runGoogleOAuth(config) {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error(
      'Configure primeiro:\n' +
      '  brag config --google-client-id <ID> --google-client-secret <SECRET>\n\n' +
      'Como obter:\n' +
      '  1. Acesse https://console.cloud.google.com\n' +
      '  2. Crie um projeto e ative as APIs: Google Drive API e Google Docs API\n' +
      '  3. Em "Credenciais" → "Criar credenciais" → "ID do cliente OAuth"\n' +
      '  4. Tipo: Aplicativo para computador\n' +
      '  5. Copie o Client ID e Client Secret'
    );
  }

  const port = await getAvailablePort();
  const redirectUri = `http://localhost:${port}/callback`;

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });

  console.log(`\nAbrindo browser para autenticação Google...`);
  console.log(`\nSe não abrir automaticamente, acesse:\n${authUrl}\n`);
  openBrowser(authUrl);

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (code) {
        res.end('<html><body><h2>✓ Autorizado! Pode fechar esta aba.</h2></body></html>');
        server.close();
        resolve(code);
      } else {
        res.end(`<html><body><h2>✗ Erro: ${error || 'desconhecido'}</h2></body></html>`);
        server.close();
        reject(new Error(`OAuth negado: ${error}`));
      }
    });
    server.listen(port);
    setTimeout(() => { server.close(); reject(new Error('Timeout: autorização não completada em 2 minutos')); }, 120_000);
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) throw new Error('Refresh token não recebido. Revogue o acesso em https://myaccount.google.com/permissions e tente novamente.');
  return tokens;
}

// ─── Drive folder management ─────────────────────────────────────────────────

async function getOrCreateFolder(name, parentId, accessToken) {
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const search = await driveRequest('GET', `files?q=${encodeURIComponent(q)}&fields=files(id)`, null, accessToken);
  if (search.files?.length > 0) return search.files[0].id;

  const folder = await driveRequest('POST', 'files', {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  }, accessToken);
  return folder.id;
}

async function getRootFolderId(config, accessToken) {
  if (config.googleDriveFolderId) return config.googleDriveFolderId;

  const folder = await driveRequest('POST', 'files', {
    name: 'brag',
    mimeType: 'application/vnd.google-apps.folder',
  }, accessToken);

  saveConfig({ googleDriveFolderId: folder.id });
  return folder.id;
}

// ─── Doc content helpers ─────────────────────────────────────────────────────

function extractDocText(doc) {
  return (doc.body?.content ?? [])
    .flatMap(el => el.paragraph?.elements ?? [])
    .map(el => el.textRun?.content ?? '')
    .join('');
}

async function createDoc(title, folderId, content, accessToken) {
  const file = await driveRequest('POST', 'files', {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [folderId],
  }, accessToken);

  await docsRequest('POST', `documents/${file.id}:batchUpdate`, {
    requests: [{ insertText: { location: { index: 1 }, text: content } }],
  }, accessToken);

  return file.id;
}

async function updateDoc(docId, content, accessToken) {
  const doc = await docsRequest('GET', `documents/${docId}`, null, accessToken);
  const endIndex = doc.body.content.at(-1)?.endIndex ?? 2;

  const requests = [];
  if (endIndex > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
  }
  requests.push({ insertText: { location: { index: 1 }, text: content } });

  await docsRequest('POST', `documents/${docId}:batchUpdate`, { requests }, accessToken);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function saveToGoogleDocs(config, ticket, branch, commit, jiraTicket = null) {
  const accessToken = await getAccessToken(config);
  const rootId = await getRootFolderId(config, accessToken);

  const label = getFolderLabel(config.folderStructure);
  const folderId = label
    ? await getOrCreateFolder(label, rootId, accessToken)
    : rootId;

  const index = loadIndex();
  const entry = index[ticket];
  let docId = entry?.docId;

  let existingContent = null;
  if (docId) {
    try {
      const doc = await docsRequest('GET', `documents/${docId}`, null, accessToken);
      existingContent = extractDocText(doc);
    } catch {
      docId = null;
    }
  }

  const content = buildOrUpdateDocument(existingContent, ticket, branch, commit, jiraTicket);
  const title = `${ticket}${jiraTicket ? ` — ${jiraTicket.summary}` : ' — Brag Document'}`;

  if (!docId) {
    docId = await createDoc(title, folderId, content, accessToken);
    index[ticket] = { docId, folder: label };
    saveIndex(index);
  } else {
    await updateDoc(docId, content, accessToken);
  }

  return `https://docs.google.com/document/d/${docId}/edit`;
}

export function listGoogleDocs() {
  const index = loadIndex();
  return Object.entries(index).map(([ticket, { docId, folder }]) => ({
    ticket,
    url: `https://docs.google.com/document/d/${docId}/edit`,
    folder,
  }));
}
