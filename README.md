# brag-cli

Auto brag document generator from git commits — reads your Jira ticket, saves a structured document to **Obsidian** or **Google Docs**, organized by semester or year.

```
◆ brag [obsidian]
  Ticket  ABC-123 — Add payment retry logic
  Branch  feature/ABC-123-payment-retry
  Commit  a1b2c3d4 fix: retry payment on timeout
  Stats   +84 adições -12 remoções em 3 arquivo(s)
  Status  In Progress · Story · High

✓ Salvo em Obsidian → ~/mind/brag/2026-S1/ABC-123.md
```

---

## How it works

1. You commit on a branch named with a Jira ticket (e.g. `feature/ABC-123-description`)
2. `brag log` runs (manually or via post-commit hook)
3. It reads the commit stats from git and the repository name
4. It fetches the ticket from the Jira API (summary, status, type, priority, description)
5. It creates/updates a document in the configured storage backend (Obsidian or Google Docs)
6. Documents are organized in folders by semester (`2026-S1/`), year (`2026/`), or flat — your choice
7. Optionally pushes the Obsidian markdown to a GitHub repository

---

## Install

```bash
npm install -g brag-cli
```

Or run locally:

```bash
git clone https://github.com/tumusx/brag-cli
cd brag-cli
npm install
npm link
```

---

## Setup

### 1. Choose your storage backend

**Obsidian (default)**

```bash
brag config --storage obsidian --obsidian /path/to/your/vault/brag
```

**Google Docs**

```bash
# Step 1: Set up OAuth credentials (Google Cloud Console)
#   → Enable "Google Drive API" and "Google Docs API"
#   → Create OAuth 2.0 credentials (Desktop app)
brag config --google-client-id YOUR_CLIENT_ID \
            --google-client-secret YOUR_CLIENT_SECRET

# Step 2: Authorize (opens browser, saves refresh token)
brag auth google

# Step 3: Activate the backend
brag config --storage googledocs
```

> **Tip:** Get OAuth credentials at https://console.cloud.google.com → APIs & Services → Credentials.

### 2. Choose folder structure

```bash
brag config --folder-structure semester   # ~/brag/2026-S1/ABC-123.md (default: flat)
brag config --folder-structure year       # ~/brag/2026/ABC-123.md
brag config --folder-structure flat       # ~/brag/ABC-123.md
```

### 3. Jira

Generate a Jira API token at: **https://id.atlassian.com/manage-profile/security/api-tokens**

```bash
brag config --jira-url https://your-company.atlassian.net \
            --jira-email you@company.com \
            --jira-token YOUR_JIRA_API_TOKEN
```

### 4. GitHub publishing (optional, Obsidian only)

Generate a GitHub PAT with `repo` scope at: **https://github.com/settings/tokens**

```bash
brag config --token YOUR_GITHUB_TOKEN \
            --owner your-username \
            --repo brag-docs
```

### Verify

```bash
brag config --show
```

---

## Usage

### Manual log

```bash
# Run inside any git repo on a Jira-named branch
brag log

# Log + publish to GitHub (Obsidian backend only)
brag log --push
```

### Auto log on every commit (recommended)

```bash
# Install the post-commit hook in the current repo
brag hook install

# Remove it
brag hook remove
```

Once installed, every `git commit` automatically runs `brag log --push`.

### Publish an existing document to GitHub

```bash
brag push ABC-123
```

### Check saved documents

```bash
brag status
```

Output groups documents by folder:

```
◆ Brag documents — Obsidian (4)

  📁 2026-S1
    ABC-123  ~/mind/brag/2026-S1/ABC-123.md
    ABC-124  ~/mind/brag/2026-S1/ABC-124.md
  📁 2026-S2
    XYZ-10   ~/mind/brag/2026-S2/XYZ-10.md
```

---

## Document format

Each ticket gets its own file. New commits are **prepended** — the document accumulates the full delivery history for that ticket.

```markdown
---
ticket: ABC-123
last_updated: 2026-04-26
summary: "Add payment retry logic"
status: In Progress
type: Story
tags: [brag, engenharia, jira]
---

# ABC-123 — Add payment retry logic

> Registro automático de entregas de valor por ticket Jira.

## Commits

### `a1b2c3d4` · 2026-04-26 · fix: retry payment on timeout

| Campo       | Valor                        |
|-------------|------------------------------|
| Repositório | `payments-service`           |
| Branch      | `feature/ABC-123-...`        |
| Autor       | Murillo Alvares              |
| Ticket      | [ABC-123](https://...)       |

**Impacto de código:** **+84** adições · **-12** remoções · **3** arquivo(s)
```

When using **Google Docs**, the same content is written into a Google Doc inside a Drive folder. A local index at `~/.brag/googledocs-index.json` maps each ticket to its document ID.

---

## Commands

| Command | Description |
|---|---|
| `brag log` | Log the last commit for the current branch ticket |
| `brag log --push` | Log + publish to GitHub (Obsidian only) |
| `brag push <ticket>` | Manually publish an existing brag doc to GitHub |
| `brag auth google` | Authorize Google Drive/Docs access |
| `brag hook install` | Install post-commit git hook |
| `brag hook remove` | Remove post-commit git hook |
| `brag config --show` | Show current configuration |
| `brag status` | List all brag documents, grouped by folder |

## Config options

| Flag | Description |
|---|---|
| `--storage` | Storage backend: `obsidian` \| `googledocs` |
| `--folder-structure` | Folder organization: `flat` \| `semester` \| `year` |
| `--obsidian` | Obsidian vault folder path |
| `--jira-url` | Jira base URL (e.g. `https://company.atlassian.net`) |
| `--jira-email` | Jira account email |
| `--jira-token` | Jira API token |
| `--token` | GitHub Personal Access Token |
| `--owner` | GitHub username or org |
| `--repo` | GitHub repo name for published docs |
| `--google-client-id` | Google OAuth Client ID |
| `--google-client-secret` | Google OAuth Client Secret |

Config is stored at `~/.brag/config.json`.

---

## Branch naming

Tickets are extracted from the branch name using the pattern `[A-Z]+-\d+`.

Examples that work:
- `feature/ABC-123-payment-retry`
- `ABC-123`
- `fix/PROJ-42-null-pointer`

Branches without a matching ticket are silently skipped.

---

## License

MIT
