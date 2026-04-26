export function formatBragEntry(branch, commit) {
  const { short, message, author, date, body, stats } = commit;

  const statsLine = stats.files > 0
    ? `**+${stats.insertions}** adições · **-${stats.deletions}** remoções · **${stats.files}** arquivo(s)`
    : 'Sem alterações de arquivo rastreadas';

  const filesBlock = stats.changedFiles.length > 0
    ? stats.changedFiles.map(f => `  - \`${f}\``).join('\n')
    : '';

  const bodyBlock = body ? `\n> ${body.split('\n').join('\n> ')}\n` : '';

  return `
### \`${short}\` · ${date} · ${message}

\`${branch}\` · ${author} · ${statsLine}
${filesBlock ? `\n**Arquivos alterados:**\n${filesBlock}\n` : ''}${bodyBlock}---
`;
}

function formatDetailsTable(ticket, branch, commit, jiraTicket) {
  const { repoName } = commit;
  const ticketUrl = jiraTicket?.url || `https://your-jira.atlassian.net/browse/${ticket}`;

  const baseRows = [
    `| **Repositório** | \`${repoName || 'desconhecido'}\` |`,
    `| **Ticket** | [${ticket}](${ticketUrl}) |`,
  ];

  if (jiraTicket) {
    const points = jiraTicket.storyPoints ? ` · **${jiraTicket.storyPoints} pts**` : '';
    const labels = jiraTicket.labels.length > 0
      ? jiraTicket.labels.map(l => `\`${l}\``).join(', ')
      : '—';

    baseRows.push(
      `| **Tipo** | ${jiraTicket.type}${points} |`,
      `| **Status** | ${jiraTicket.status} |`,
      `| **Prioridade** | ${jiraTicket.priority} |`,
      `| **Assignee** | ${jiraTicket.assignee} |`,
      `| **Labels** | ${labels} |`,
    );
  }

  const desc = jiraTicket?.description
    ? `\n> ${jiraTicket.description.split('\n').slice(0, 3).join('\n> ')}\n`
    : '';

  return `## Detalhes

| Campo | Valor |
|---|---|
${baseRows.join('\n')}
${desc}`;
}

export function buildOrUpdateDocument(existing, ticket, branch, commit, jiraTicket = null) {
  const entry = formatBragEntry(branch, commit);
  const today = new Date().toISOString().split('T')[0];

  if (!existing) {
    const jiraMeta = jiraTicket
      ? `summary: "${jiraTicket.summary}"\nstatus: ${jiraTicket.status}\ntype: ${jiraTicket.type}\n`
      : '';

    const details = formatDetailsTable(ticket, branch, commit, jiraTicket);

    return `---
ticket: ${ticket}
last_updated: ${today}
${jiraMeta}tags: [brag, engenharia, jira]
---

# ${ticket}${jiraTicket ? ` — ${jiraTicket.summary}` : ' — Brag Document'}

> Registro automático de entregas de valor por ticket Jira.

${details}
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
