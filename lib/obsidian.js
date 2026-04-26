import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { buildOrUpdateDocument } from './formatter.js';

export function saveToObsidian(obsidianPath, ticket, branch, commit) {
  if (!existsSync(obsidianPath)) {
    mkdirSync(obsidianPath, { recursive: true });
  }

  const filePath = join(obsidianPath, `${ticket}.md`);
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
  const content = buildOrUpdateDocument(existing, ticket, branch, commit);

  writeFileSync(filePath, content, 'utf8');
  return filePath;
}
