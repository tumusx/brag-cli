export function formatBragEntry(ticket, branch, commit, jiraTicket = null) {
  const { short, message, author, date, body, stats, repoName } = commit;

  const statsLine = stats.files > 0
    ? `**+${stats.insertions}** adições · **-${stats.deletions}** remoções · **${stats.files}** arquivo(s)`
    : 'Sem alterações de arquivo rastreadas';

  const filesBlock = stats.changedFiles.length > 0
    ? stats.changedFiles.map(f => `  - \`${f}\``).join('\n')
    : '';

  const bodyBlock = body ? `\n> ${body.split('\n').join('\n> ')}\n` : '';

  const jiraBlock = jiraTicket ? formatJiraSection(jiraTicket) : '';

  return `
### \`${short}\` · ${date} · ${message}

| Campo | Valor |
|---|---|
| **Repositório** | \`${repoName || 'desconhecido'}\` |
| **Branch** | \`${branch}\` |
| **Autor** | ${author} |
| **Ticket** | [${ticket}](${jiraTicket?.url || `https://your-jira.atlassian.net/browse/${ticket}`}) |

**Impacto de código:** ${statsLine}
${filesBlock ? `\n**Arquivos alterados:**\n${filesBlock}` : ''}${bodyBlock}${jiraBlock}---
`;
}

function formatJiraSection(t) {
  const points = t.storyPoints ? ` · **${t.storyPoints} pts**` : '';
  const labels = t.labels.length > 0 ? t.labels.map(l => `\`${l}\``).join(', ') : '—';
  const desc = t.description ? `\n> ${t.description.split('\n').slice(0, 3).join('\n> ')}` : '';

  return `
**Jira — ${t.key}**

| Campo | Valor |
|---|---|
| **Título** | ${t.summary} |
| **Tipo** | ${t.type}${points} |
| **Status** | ${t.status} |
| **Prioridade** | ${t.priority} |
| **Assignee** | ${t.assignee} |
| **Reporter** | ${t.reporter} |
| **Atualizado** | ${t.updated} |
| **Labels** | ${labels} |
${desc ? `\n**Descrição:**${desc}\n` : ''}
`;
}

export function buildOrUpdateDocument(existing, ticket, branch, commit, jiraTicket = null) {
  const entry = formatBragEntry(ticket, branch, commit, jiraTicket);
  const today = new Date().toISOString().split('T')[0];

  if (!existing) {
    const jiraMeta = jiraTicket
      ? `summary: "${jiraTicket.summary}"\nstatus: ${jiraTicket.status}\ntype: ${jiraTicket.type}\n`
      : '';

    return `---
ticket: ${ticket}
last_updated: ${today}
${jiraMeta}tags: [brag, engenharia, jira]
---

# ${ticket}${jiraTicket ? ` — ${jiraTicket.summary}` : ' — Brag Document'}

> Registro automático de entregas de valor por ticket Jira.

## Commits

${entry}`;
  }

  // Update last_updated and jira status in frontmatter
  let updated = existing.replace(
    /last_updated: \d{4}-\d{2}-\d{2}/,
    `last_updated: ${today}`
  );

  if (jiraTicket) {
    updated = updated.replace(/status: .+/, `status: ${jiraTicket.status}`);
  }

  if (updated.includes('## Commits')) {
    return updated.replace('## Commits\n', `## Commits\n${entry}`);
  }

  return updated + '\n## Commits\n' + entry;
}
