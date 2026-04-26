import { writeFileSync, existsSync, mkdirSync, chmodSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const HOOK_MARKER = '# brag-cli managed';

const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER}
brag log --push 2>&1 | tee -a ~/.brag/hook.log
`;

export function installHook(cwd = process.cwd()) {
  let gitDir;
  try {
    gitDir = execSync('git rev-parse --git-dir', { cwd, encoding: 'utf8' }).trim();
    if (!gitDir.startsWith('/')) gitDir = join(cwd, gitDir);
  } catch {
    throw new Error('Não é um repositório git. Execute brag hook install dentro de um repo.');
  }

  const hooksDir = join(gitDir, 'hooks');
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

  const hookPath = join(hooksDir, 'post-commit');

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    if (existing.includes(HOOK_MARKER)) {
      return { hookPath, updated: false, message: 'Hook já instalado.' };
    }
    // Append to existing hook
    writeFileSync(hookPath, existing.trimEnd() + '\n\n' + HOOK_SCRIPT, 'utf8');
  } else {
    writeFileSync(hookPath, HOOK_SCRIPT, 'utf8');
  }

  chmodSync(hookPath, '755');
  return { hookPath, updated: true, message: `Hook instalado em ${hookPath}` };
}

export function removeHook(cwd = process.cwd()) {
  let gitDir;
  try {
    gitDir = execSync('git rev-parse --git-dir', { cwd, encoding: 'utf8' }).trim();
    if (!gitDir.startsWith('/')) gitDir = join(cwd, gitDir);
  } catch {
    throw new Error('Não é um repositório git.');
  }

  const hookPath = join(gitDir, 'hooks', 'post-commit');
  if (!existsSync(hookPath)) return { message: 'Nenhum hook encontrado.' };

  const content = readFileSync(hookPath, 'utf8');
  if (!content.includes(HOOK_MARKER)) return { message: 'Hook do brag não encontrado neste repo.' };

  const cleaned = content
    .split('\n')
    .filter((_, i, arr) => {
      const block = arr.slice(Math.max(0, i - 1), i + 3).join('\n');
      return !block.includes(HOOK_MARKER);
    })
    .join('\n')
    .trim();

  if (!cleaned || cleaned === '#!/bin/sh') {
    writeFileSync(hookPath, '#!/bin/sh\n', 'utf8');
  } else {
    writeFileSync(hookPath, cleaned + '\n', 'utf8');
  }

  return { message: `Hook removido de ${hookPath}` };
}
