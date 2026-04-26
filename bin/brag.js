#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig, getConfigPath } from '../lib/config.js';
import { getCurrentBranch, getLastCommit, extractTicket, isGitRepo } from '../lib/git.js';
import { saveToObsidian } from '../lib/obsidian.js';
import { publishBragDoc } from '../lib/github.js';
import { installHook, removeHook } from '../lib/hook.js';

const program = new Command();

program
  .name('brag')
  .description('Registra entregas de valor por commit → Obsidian + GitHub')
  .version('1.0.0');

// ─── brag log ────────────────────────────────────────────────────────────────
program
  .command('log')
  .description('Registra o último commit como entrada de brag document')
  .option('--push', 'Publica no GitHub após salvar no Obsidian')
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

      console.log(chalk.blue(`\n◆ brag`));
      console.log(`  Ticket  ${chalk.cyan(ticket)}`);
      console.log(`  Branch  ${chalk.gray(branch)}`);
      console.log(`  Commit  ${chalk.gray(commit.short)} ${commit.message}`);
      console.log(`  Stats   ${chalk.green(`+${commit.stats.insertions}`)} ${chalk.red(`-${commit.stats.deletions}`)} em ${commit.stats.files} arquivo(s)\n`);

      const filePath = saveToObsidian(config.obsidianPath, ticket, branch, commit);
      console.log(chalk.green(`✓ Salvo no Obsidian`) + chalk.gray(` → ${filePath}`));

      if (opts.push) {
        try {
          const url = await publishBragDoc(config, ticket, filePath);
          console.log(chalk.green(`✓ Publicado no GitHub`) + chalk.gray(` → ${url}`));
        } catch (err) {
          console.error(chalk.red(`✗ GitHub: ${err.message}`));
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
  .description('Publica manualmente o brag document de um ticket no GitHub')
  .action(async (ticket) => {
    try {
      const config = loadConfig();
      const { join } = await import('path');
      const filePath = join(config.obsidianPath, `${ticket}.md`);

      const { existsSync } = await import('fs');
      if (!existsSync(filePath)) {
        console.error(chalk.red(`✗ Arquivo não encontrado: ${filePath}`));
        process.exit(1);
      }

      const url = await publishBragDoc(config, ticket, filePath);
      console.log(chalk.green(`✓ Publicado`) + ` → ${url}`);
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
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
  .option('--token <token>', 'GitHub Personal Access Token')
  .option('--owner <owner>', 'GitHub username/org (padrão: tumusx)')
  .option('--repo <repo>', 'Nome do repositório GitHub (padrão: brag-docs)')
  .option('--obsidian <path>', 'Caminho da pasta brag no Obsidian')
  .option('--show', 'Mostra a configuração atual')
  .action((opts) => {
    const config = loadConfig();

    if (opts.show) {
      console.log(chalk.blue('\n◆ Configuração atual\n'));
      console.log(`  Obsidian   ${config.obsidianPath}`);
      console.log(`  GitHub     https://github.com/${config.githubOwner}/${config.githubRepo}`);
      console.log(`  Token      ${config.githubToken ? chalk.green('✓ configurado') : chalk.red('✗ não configurado')}`);
      console.log(chalk.gray(`\n  Arquivo: ${getConfigPath()}\n`));
      return;
    }

    const updates = {};
    if (opts.token) updates.githubToken = opts.token;
    if (opts.owner) updates.githubOwner = opts.owner;
    if (opts.repo) updates.githubRepo = opts.repo;
    if (opts.obsidian) updates.obsidianPath = opts.obsidian;

    if (Object.keys(updates).length === 0) {
      program.commands.find(c => c.name() === 'config').help();
      return;
    }

    saveConfig(updates);
    console.log(chalk.green('✓ Configuração salva.'));
    if (opts.token) console.log(chalk.gray('  Token GitHub armazenado em ~/.brag/config.json'));
  });

// ─── brag status ─────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Mostra os brag documents salvos no Obsidian')
  .action(async () => {
    const config = loadConfig();
    const { readdirSync, existsSync } = await import('fs');

    if (!existsSync(config.obsidianPath)) {
      console.log(chalk.yellow('⚠ Nenhum brag document encontrado ainda.'));
      console.log(chalk.gray(`  Pasta: ${config.obsidianPath}`));
      return;
    }

    const files = readdirSync(config.obsidianPath).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
      console.log(chalk.yellow('⚠ Pasta vazia. Faça um commit em uma branch com ticket Jira.'));
      return;
    }

    console.log(chalk.blue(`\n◆ Brag documents (${files.length})\n`));
    files.forEach(f => {
      const ticket = f.replace('.md', '');
      console.log(`  ${chalk.cyan(ticket)}  ${chalk.gray(config.obsidianPath + '/' + f)}`);
    });
    console.log();
  });

program.parse();
