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
  jiraBaseUrl: '',
  jiraEmail: '',
  jiraToken: '',
};

export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return { ...DEFAULTS };
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const saved = JSON.parse(raw);
    const merged = { ...DEFAULTS, ...saved };
    // Regex can't round-trip through JSON — always restore from defaults or re-parse string
    if (typeof saved.ticketPattern === 'string') {
      merged.ticketPattern = new RegExp(saved.ticketPattern);
    } else {
      merged.ticketPattern = DEFAULTS.ticketPattern;
    }
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(data) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const current = loadConfig();
  const toSave = { ...current, ...data };
  // Serialize ticketPattern as its source string
  if (toSave.ticketPattern instanceof RegExp) {
    toSave.ticketPattern = toSave.ticketPattern.source;
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), 'utf8');
}

export function getConfigPath() {
  return CONFIG_FILE;
}
