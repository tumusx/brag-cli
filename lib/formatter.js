export function formatBragEntry(ticket, branch, commit) {
  const { short, message, author, date, body, stats, repoName } = commit;

  const statsLine = stats.files > 0
    ? `**+${stats.insertions}** adições · **-${stats.deletions}** remoções · **${stats.files}** arquivo(s)`
    : 'Sem alterações de arquivo rastreadas';

  const filesBlock = stats.changedFiles.length > 0
    ? stats.changedFiles.map(f => `  - \`${f}\``).join('\n')
    : '';

  const bodyBlock = body ? `\n> ${body.split('\n').join('\n> ')}\n` : '';

  return `
### \`${short}\` · ${date} · ${message}

| Campo | Valor |
|---|---|
| **Repositório** | \`${repoName || 'desconhecido'}\` |
| **Branch** | \`${branch}\` |
| **Autor** | ${author} |
| **Ticket** | [${ticket}](https://your-jira.atlassian.net/browse/${ticket}) |

**Impacto de código:** ${statsLine}
${filesBlock ? `\n**Arquivos alterados:**\n${filesBlock}` : ''}${bodyBlock}
---
`;
}

export function buildOrUpdateDocument(existing, ticket, branch, commit) {
  const entry = formatBragEntry(ticket, branch, commit);
  const today = new Date().toISOString().split('T')[0];

  if (!existing) {
    return `---
ticket: ${ticket}
last_updated: ${today}
tags: [brag, engenharia, jira]
---

# ${ticket} — Brag Document

> Registro automático de entregas de valor por ticket Jira.

## Commits

${entry}`;
  }

  // Update last_updated in frontmatter
  const updated = existing.replace(
    /last_updated: \d{4}-\d{2}-\d{2}/,
    `last_updated: ${today}`
  );

  // Append new entry before the last --- or at end
  if (updated.includes('## Commits')) {
    return updated.replace('## Commits\n', `## Commits\n${entry}`);
  }

  return updated + '\n## Commits\n' + entry;
}
