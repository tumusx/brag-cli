#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig, getConfigPath } from '../lib/config.js';
import { getCurrentBranch, getLastCommit, extractTicket, isGitRepo } from '../lib/git.js';
import { publishBragDoc } from '../lib/github.js';
import { installHook, removeHook } from '../lib/hook.js';
import { fetchTicket } from '../lib/jira.js';
import { saveBragDoc, listBragDocs, findTicketFile } from '../lib/storage.js';
import { runGoogleOAuth } from '../lib/googledocs.js';

const program = new Command();

program
  .name('brag')
  .description('Registra entregas de valor por commit → Obsidian ou Google Docs')
  .version('1.0.0');

// ─── brag log ────────────────────────────────────────────────────────────────
program
  .command('log')
  .description('Registra o último commit como entrada de brag document')
  .option('--push', 'Publica no GitHub após salvar (apenas backend Obsidian)')
  .option('--cwd <path>', 'Diretório do repositório', process.cwd())
  .action(async (opts) => {
    try {
      if (!isGitRepo(opts.cwd)) {
        console.error(chalk.red('✗ Não é um repositório git.'));
        process.exit(1);
      }

      const config = loadConfig();
      const branch = getCurrentBranch(opts.cwd);
      const ticket = extractTicket(branch, config.ticketPattern);

      if (!ticket) {
        console.log(chalk.yellow(`⚠ Nenhum ticket encontrado na branch "${branch}". Pulando.`));
        process.exit(0);
      }

      const commit = getLastCommit(opts.cwd);

      let jiraTicket = null;
      if (config.jiraBaseUrl && config.jiraEmail && config.jiraToken) {
        try {
          jiraTicket = await fetchTicket(config, ticket);
        } catch (err) {
          console.log(chalk.yellow(`⚠ Jira: ${err.message}`));
        }
      }

      const backendLabel = config.storageBackend === 'googledocs'
        ? chalk.blue('Google Docs')
        : chalk.blue('Obsidian');

      console.log(chalk.blue(`\n◆ brag`) + chalk.gray(` [${config.storageBackend}]`));
      console.log(`  Ticket  ${chalk.cyan(ticket)}${jiraTicket ? chalk.gray(` — ${jiraTicket.summary}`) : ''}`);
      console.log(`  Branch  ${chalk.gray(branch)}`);
      console.log(`  Commit  ${chalk.gray(commit.short)} ${commit.message}`);
      console.log(`  Stats   ${chalk.green(`+${commit.stats.insertions}`)} ${chalk.red(`-${commit.stats.deletions}`)} em ${commit.stats.files} arquivo(s)`);
      if (jiraTicket) {
        console.log(`  Status  ${chalk.magenta(jiraTicket.status)} · ${jiraTicket.type} · ${jiraTicket.priority}`);
      }
      console.log();

      const result = await saveBragDoc(config, ticket, branch, commit, jiraTicket);
      console.log(chalk.green(`✓ Salvo em ${backendLabel}`) + chalk.gray(` → ${result}`));

      if (opts.push) {
        if (config.storageBackend === 'googledocs') {
          console.log(chalk.yellow(`⚠ --push é para GitHub e só funciona com o backend Obsidian.`));
        } else {
          try {
            const filePath = result;
            const url = await publishBragDoc(config, ticket, filePath);
            console.log(chalk.green(`✓ Publicado no GitHub`) + chalk.gray(` → ${url}`));
          } catch (err) {
            console.error(chalk.red(`✗ GitHub: ${err.message}`));
          }
        }
      }
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// ─── brag push ───────────────────────────────────────────────────────────────
program
  .command('push <ticket>')
  .description('Publica manualmente o brag document de um ticket no GitHub (apenas Obsidian)')
  .action(async (ticket) => {
    try {
      const config = loadConfig();

      if (config.storageBackend === 'googledocs') {
        console.log(chalk.yellow(`⚠ Backend Google Docs: o documento já está no Google Drive.`));
        process.exit(0);
      }

      const filePath = findTicketFile(config, ticket);
      if (!filePath) {
        console.error(chalk.red(`✗ Arquivo não encontrado para o ticket: ${ticket}`));
        process.exit(1);
      }

      const url = await publishBragDoc(config, ticket, filePath);
      console.log(chalk.green(`✓ Publicado`) + ` → ${url}`);
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// ─── brag auth ───────────────────────────────────────────────────────────────
const auth = program.command('auth').description('Autenticação com serviços externos');

auth
  .command('google')
  .description('Autoriza o brag-cli a acessar o Google Drive e Google Docs')
  .action(async () => {
    try {
      const config = loadConfig();
      const tokens = await runGoogleOAuth(config);
      saveConfig({ googleRefreshToken: tokens.refresh_token });
      console.log(chalk.green('\n✓ Google autorizado com sucesso!'));
      console.log(chalk.gray('  Refresh token salvo em ~/.brag/config.json'));
      console.log(chalk.gray('\n  Agora configure o backend:'));
      console.log(chalk.cyan('  brag config --storage googledocs'));
    } catch (err) {
      console.error(chalk.red(`\n✗ ${err.message}`));
      process.exit(1);
    }
  });

// ─── brag hook ───────────────────────────────────────────────────────────────
const hook = program.command('hook').description('Gerencia o git hook de post-commit');

hook
  .command('install')
  .description('Instala o post-commit hook no repositório atual')
  .option('--cwd <path>', 'Diretório do repositório', process.cwd())
  .action((opts) => {
    try {
      const result = installHook(opts.cwd);
      console.log(chalk.green(`✓ ${result.message}`));
      if (result.updated) {
        console.log(chalk.gray(`  A cada commit, o brag será registrado automaticamente.`));
      }
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

hook
  .command('remove')
  .description('Remove o post-commit hook do repositório atual')
  .option('--cwd <path>', 'Diretório do repositório', process.cwd())
  .action((opts) => {
    try {
      const result = removeHook(opts.cwd);
      console.log(chalk.yellow(`○ ${result.message}`));
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// ─── brag config ─────────────────────────────────────────────────────────────
program
  .command('config')
  .description('Configura o brag-cli')
  .option('--storage <backend>', 'Backend de armazenamento: obsidian | googledocs')
  .option('--folder-structure <type>', 'Organização de pastas: flat | semester | year')
  .option('--token <token>', 'GitHub Personal Access Token')
  .option('--owner <owner>', 'GitHub username/org')
  .option('--repo <repo>', 'Nome do repositório GitHub')
  .option('--obsidian <path>', 'Caminho da pasta brag no Obsidian')
  .option('--jira-url <url>', 'URL base do Jira (ex: https://empresa.atlassian.net)')
  .option('--jira-email <email>', 'Email da conta Jira')
  .option('--jira-token <token>', 'Jira API Token')
  .option('--google-client-id <id>', 'Google OAuth Client ID')
  .option('--google-client-secret <secret>', 'Google OAuth Client Secret')
  .option('--show', 'Mostra a configuração atual')
  .action((opts) => {
    const config = loadConfig();

    if (opts.show) {
      const folderInfo = {
        flat:     'flat (sem subpastas)',
        year:     'por ano (ex: 2026/)',
        semester: 'por semestre (ex: 2026-S1/)',
        quarter:  'por quarter (ex: 2026-Q2/)',
      }[config.folderStructure] ?? config.folderStructure;

      console.log(chalk.blue('\n◆ Configuração atual\n'));
      console.log(`  Backend    ${chalk.cyan(config.storageBackend)}`);
      console.log(`  Pastas     ${folderInfo}`);
      if (config.storageBackend === 'obsidian') {
        console.log(`  Obsidian   ${config.obsidianPath}`);
      }
      console.log(`  GitHub     https://github.com/${config.githubOwner}/${config.githubRepo}`);
      console.log(`  Token GH   ${config.githubToken ? chalk.green('✓ configurado') : chalk.red('✗ não configurado')}`);
      console.log(`  Jira URL   ${config.jiraBaseUrl || chalk.gray('não configurado')}`);
      console.log(`  Jira Email ${config.jiraEmail || chalk.gray('não configurado')}`);
      console.log(`  Jira Token ${config.jiraToken ? chalk.green('✓ configurado') : chalk.red('✗ não configurado')}`);
      console.log(`  Google ID  ${config.googleClientId ? chalk.green('✓ configurado') : chalk.gray('não configurado')}`);
      console.log(`  Google Tk  ${config.googleRefreshToken ? chalk.green('✓ autorizado') : chalk.red('✗ não autorizado')}`);
      console.log(chalk.gray(`\n  Arquivo: ${getConfigPath()}\n`));
      return;
    }

    const updates = {};
    if (opts.storage) {
      if (!['obsidian', 'googledocs'].includes(opts.storage)) {
        console.error(chalk.red('✗ --storage deve ser "obsidian" ou "googledocs"'));
        process.exit(1);
      }
      updates.storageBackend = opts.storage;
    }
    if (opts.folderStructure) {
      if (!['flat', 'semester', 'quarter', 'year'].includes(opts.folderStructure)) {
        console.error(chalk.red('✗ --folder-structure deve ser "flat", "semester", "quarter" ou "year"'));
        process.exit(1);
      }
      updates.folderStructure = opts.folderStructure;
    }
    if (opts.token) updates.githubToken = opts.token;
    if (opts.owner) updates.githubOwner = opts.owner;
    if (opts.repo) updates.githubRepo = opts.repo;
    if (opts.obsidian) updates.obsidianPath = opts.obsidian;
    if (opts.jiraUrl) updates.jiraBaseUrl = opts.jiraUrl;
    if (opts.jiraEmail) updates.jiraEmail = opts.jiraEmail;
    if (opts.jiraToken) updates.jiraToken = opts.jiraToken;
    if (opts.googleClientId) updates.googleClientId = opts.googleClientId;
    if (opts.googleClientSecret) updates.googleClientSecret = opts.googleClientSecret;

    if (Object.keys(updates).length === 0) {
      program.commands.find(c => c.name() === 'config').help();
      return;
    }

    saveConfig(updates);
    console.log(chalk.green('✓ Configuração salva.'));
    if (updates.storageBackend) {
      console.log(chalk.gray(`  Backend: ${updates.storageBackend}`));
      if (updates.storageBackend === 'googledocs' && !config.googleRefreshToken) {
        console.log(chalk.yellow(`\n  ⚠ Google ainda não autorizado. Execute: brag auth google`));
      }
    }
    if (updates.folderStructure) {
      const desc = {
        flat:     'sem subpastas',
        year:     'por ano (ex: 2026/)',
        semester: 'por semestre (ex: 2026-S1/)',
        quarter:  'por quarter (ex: 2026-Q2/)',
      }[updates.folderStructure] ?? updates.folderStructure;
      console.log(chalk.gray(`  Pastas: ${desc}`));
    }
  });

// ─── brag status ─────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Mostra os brag documents salvos')
  .action(async () => {
    const config = loadConfig();
    const docs = listBragDocs(config);

    if (docs.length === 0) {
      console.log(chalk.yellow('⚠ Nenhum brag document encontrado ainda.'));
      return;
    }

    // Group by folder
    const groups = {};
    for (const doc of docs) {
      const key = doc.folder ?? '(raiz)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    }

    const backendLabel = config.storageBackend === 'googledocs' ? 'Google Docs' : 'Obsidian';
    console.log(chalk.blue(`\n◆ Brag documents — ${backendLabel} (${docs.length})\n`));

    for (const [folder, entries] of Object.entries(groups).sort()) {
      if (folder !== '(raiz)') console.log(chalk.gray(`  📁 ${folder}`));
      for (const doc of entries) {
        const location = doc.url ?? doc.path;
        const indent = folder !== '(raiz)' ? '    ' : '  ';
        console.log(`${indent}${chalk.cyan(doc.ticket)}  ${chalk.gray(location)}`);
      }
    }
    console.log();
  });

program.parse();
