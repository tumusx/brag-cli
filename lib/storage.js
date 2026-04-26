import { saveToObsidian, findObsidianTicketFile, listObsidianDocs } from './obsidian.js';
import { saveToGoogleDocs, listGoogleDocs } from './googledocs.js';

export async function saveBragDoc(config, ticket, branch, commit, jiraTicket = null) {
  if (config.storageBackend === 'googledocs') {
    return saveToGoogleDocs(config, ticket, branch, commit, jiraTicket);
  }
  return saveToObsidian(config, ticket, branch, commit, jiraTicket);
}

export function listBragDocs(config) {
  if (config.storageBackend === 'googledocs') {
    return listGoogleDocs();
  }
  return listObsidianDocs(config);
}

export function findTicketFile(config, ticket) {
  if (config.storageBackend === 'googledocs') return null;
  return findObsidianTicketFile(config, ticket);
}
