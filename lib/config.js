import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.brag');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  obsidianPath: join(homedir(), 'Projects/mind/brag'),
  githubToken: '',
  githubOwner: 'tumusx',
  githubRepo: 'brag-docs',
  ticketPattern: /([A-Z]+-\d+)/,
};

export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return { ...DEFAULTS };
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(data) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const current = loadConfig();
  writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...data }, null, 2), 'utf8');
}

export function getConfigPath() {
  return CONFIG_FILE;
}
