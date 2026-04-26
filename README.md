# brag-cli

Auto brag document generator from git commits — reads your Jira ticket, saves a structured document to Obsidian, and publishes it to GitHub.

```
◆ brag
  Ticket  ABC-123 — Add payment retry logic
  Branch  feature/ABC-123-payment-retry
  Commit  a1b2c3d4 fix: retry payment on timeout
  Stats   +84 adições -12 remoções em 3 arquivo(s)
  Status  In Progress · Story · High
```

---

## How it works

1. You commit on a branch named with a Jira ticket (e.g. `feature/ABC-123-description`)
2. `brag log` runs (manually or via post-commit hook)
3. It reads the commit stats from git
4. It fetches the ticket from the Jira API (summary, status, type, priority, description)
5. It creates/updates a markdown file in your Obsidian vault
6. Optionally pushes the document to a GitHub repository

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

### 1. Jira

Generate a Jira API token at: **https://id.atlassian.com/manage-profile/security/api-tokens**

```bash
brag config --jira-url https://your-company.atlassian.net \
            --jira-email you@company.com \
            --jira-token YOUR_JIRA_API_TOKEN
```

### 2. Obsidian

```bash
brag config --obsidian /path/to/your/vault/brag
```

### 3. GitHub (optional)

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

# Log + publish to GitHub
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

### Publish an existing document

```bash
brag push ABC-123
```

### Check saved documents

```bash
brag status
```

---

## Obsidian document format

Each ticket gets its own `.md` file in the configured Obsidian folder.

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

**Jira — ABC-123**

| Campo      | Valor                   |
|------------|-------------------------|
| Título     | Add payment retry logic |
| Tipo       | Story                   |
| Status     | In Progress             |
| Prioridade | High                    |
| Assignee   | Murillo Alvares         |
| Atualizado | 2026-04-26              |
```

Each new commit on the same ticket **prepends** a new entry — the document accumulates the full delivery history for that ticket.

---

## Commands

| Command | Description |
|---|---|
| `brag log` | Log the last commit for the current branch ticket |
| `brag log --push` | Log + publish to GitHub |
| `brag push <ticket>` | Manually publish an existing brag doc to GitHub |
| `brag hook install` | Install post-commit git hook |
| `brag hook remove` | Remove post-commit git hook |
| `brag config --show` | Show current configuration |
| `brag status` | List all brag documents saved locally |

## Config options

| Flag | Description |
|---|---|
| `--jira-url` | Jira base URL (e.g. `https://company.atlassian.net`) |
| `--jira-email` | Jira account email |
| `--jira-token` | Jira API token |
| `--obsidian` | Obsidian vault folder path |
| `--token` | GitHub Personal Access Token |
| `--owner` | GitHub username or org |
| `--repo` | GitHub repo name for published docs |

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
