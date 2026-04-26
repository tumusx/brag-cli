const JIRA_API_VERSION = 'rest/api/3';

function basicAuth(email, token) {
  return Buffer.from(`${email}:${token}`).toString('base64');
}

async function apiCall(baseUrl, email, token, path) {
  const res = await fetch(`${baseUrl}/${JIRA_API_VERSION}/${path}`, {
    headers: {
      Authorization: `Basic ${basicAuth(email, token)}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jira API ${res.status}: ${err}`);
  }

  return res.json();
}

export async function fetchTicket(config, ticketKey) {
  const { jiraBaseUrl, jiraEmail, jiraToken } = config;

  if (!jiraBaseUrl || !jiraEmail || !jiraToken) {
    throw new Error('Jira não configurado. Execute: brag config --jira-url URL --jira-email EMAIL --jira-token TOKEN');
  }

  const data = await apiCall(jiraBaseUrl, jiraEmail, jiraToken, `issue/${ticketKey}`);

  const fields = data.fields;

  return {
    key: data.key,
    summary: fields.summary || '',
    status: fields.status?.name || '',
    type: fields.issuetype?.name || '',
    priority: fields.priority?.name || '',
    assignee: fields.assignee?.displayName || 'Não atribuído',
    reporter: fields.reporter?.displayName || '',
    created: fields.created?.split('T')[0] || '',
    updated: fields.updated?.split('T')[0] || '',
    description: extractDescription(fields.description),
    storyPoints: fields.story_points || fields.customfield_10016 || null,
    labels: fields.labels || [],
    url: `${jiraBaseUrl}/browse/${ticketKey}`,
  };
}

function extractDescription(descriptionAdf) {
  if (!descriptionAdf) return '';
  if (typeof descriptionAdf === 'string') return descriptionAdf;

  // Extract plain text from Atlassian Document Format (ADF)
  return extractTextFromAdf(descriptionAdf).slice(0, 500).trim();
}

function extractTextFromAdf(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromAdf).join(' ');
  }
  return '';
}
