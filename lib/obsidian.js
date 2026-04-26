import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { buildOrUpdateDocument } from './formatter.js';
import { getFolderLabel } from './folders.js';

export function saveToObsidian(config, ticket, branch, commit, jiraTicket = null) {
  const label = getFolderLabel(config.folderStructure);
  const targetPath = label ? join(config.obsidianPath, label) : config.obsidianPath;
  mkdirSync(targetPath, { recursive: true });

  const filePath = join(targetPath, `${ticket}.md`);
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
  const content = buildOrUpdateDocument(existing, ticket, branch, commit, jiraTicket);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export function findObsidianTicketFile(config, ticket) {
  const label = getFolderLabel(config.folderStructure);

  // Current period folder first
  if (label) {
    const f = join(config.obsidianPath, label, `${ticket}.md`);
    if (existsSync(f)) return f;
  }

  // Flat fallback
  const flat = join(config.obsidianPath, `${ticket}.md`);
  if (existsSync(flat)) return flat;

  // Search all subfolders
  if (existsSync(config.obsidianPath)) {
    for (const entry of readdirSync(config.obsidianPath)) {
      const sub = join(config.obsidianPath, entry);
      if (statSync(sub).isDirectory()) {
        const candidate = join(sub, `${ticket}.md`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

export function listObsidianDocs(config) {
  if (!existsSync(config.obsidianPath)) return [];

  const results = [];

  for (const entry of readdirSync(config.obsidianPath)) {
    const entryPath = join(config.obsidianPath, entry);
    if (entry.endsWith('.md')) {
      results.push({ ticket: entry.replace('.md', ''), path: entryPath, folder: null });
    } else if (statSync(entryPath).isDirectory()) {
      for (const f of readdirSync(entryPath)) {
        if (f.endsWith('.md')) {
          results.push({ ticket: f.replace('.md', ''), path: join(entryPath, f), folder: entry });
        }
      }
    }
  }

  return results;
}
