#!/usr/bin/env node
// Install the trimmed always-loaded context. Backs up every file it touches to ~/.claude/backups/context-<ts>/.
//   node scripts/apply-context.mjs --dry-run   show before/after sizes, change nothing
//   node scripts/apply-context.mjs             apply
// 1. config/global/{CLAUDE,RTK}.md -> ~/.claude/ (the file all 3 accounts symlink to)
// 2. MEMORY.md split: project bullets + always-on preferences stay; topic sub-bullets, gotchas, references
//    and cross-project notes move verbatim to references.md (read on demand). Idempotent.
// 3. config/global/settings-env.json merged into ~/.claude/settings.json "env".
// Rollback: copy the files in the printed backup dir back to where they came from.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'config', 'global');
const MARK = '<!-- split: references.md -->';

export function splitMemory(text, preferences, date) {
  if (text.includes(MARK)) return null; // already split
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^## Projects\b/.test(l));
  const end = lines.findIndex((l, i) => i > start && (/^---\s*$/.test(l) || /^## /.test(l)));
  if (start === -1) throw new Error('MEMORY.md has no "## Projects" section; not splitting');
  const projects = lines.slice(start + 1, end === -1 ? lines.length : end);
  const keep = [];
  const topics = [];
  let parent = null;
  for (const l of projects) {
    if (/^- /.test(l)) { keep.push(l); parent = (l.match(/^- \[([^\]]+)\]/) || [null, l.slice(2, 50)])[1]; }
    else if (l.trim()) topics.push(`- (${parent}) ${l.trim().replace(/^- /, '')}`);
  }
  const rest = end === -1 ? [] : lines.slice(end);
  const head = lines.slice(0, start).filter((l) => l.trim() && !/^# /.test(l));
  const memory = [
    `# Memory index ${MARK}`,
    'Projects only. Topic files, gotchas, references, cross-project notes: references.md in this folder (read on demand).',
    '',
    '## Projects',
    ...keep,
    '',
    preferences.trim(),
    '',
  ].join('\n');
  const references = [
    `# Memory references (moved out of MEMORY.md ${date}; not auto-loaded)`,
    '',
    ...(head.length ? ['## Former MEMORY.md header', ...head, ''] : []),
    '## Project topic files',
    ...topics,
    '',
    ...rest.filter((l) => !/^---\s*$/.test(l)),
    '',
  ].join('\n');
  return { memory, references };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry-run');
  const claudeDir = join(homedir(), '.claude');
  const memDir = join(claudeDir, 'projects', '-Users-adamwolfe', 'memory');
  const targets = {
    claude: realpathSync(join(claudeDir, 'CLAUDE.md')),
    rtk: realpathSync(join(claudeDir, 'RTK.md')),
    memory: realpathSync(join(memDir, 'MEMORY.md')),
    references: join(memDir, 'references.md'),
    settings: realpathSync(join(claudeDir, 'settings.json')),
  };
  const size = (f) => (existsSync(f) ? readFileSync(f).length : 0);
  const split = splitMemory(readFileSync(targets.memory, 'utf8'), readFileSync(join(SRC, 'memory-preferences.md'), 'utf8'), new Date().toISOString().slice(0, 10));
  const settings = JSON.parse(readFileSync(targets.settings, 'utf8'));
  const env = { ...(settings.env || {}), ...JSON.parse(readFileSync(join(SRC, 'settings-env.json'), 'utf8')) };
  const writes = [
    [targets.claude, readFileSync(join(SRC, 'CLAUDE.md'), 'utf8')],
    [targets.rtk, readFileSync(join(SRC, 'RTK.md'), 'utf8')],
    ...(split ? [[targets.memory, split.memory], [targets.references, `${split.references}${existsSync(targets.references) ? `\n${readFileSync(targets.references, 'utf8')}` : ''}`]] : []),
    [targets.settings, `${JSON.stringify({ ...settings, env }, null, 2)}\n`],
  ];
  for (const [f, body] of writes) console.log(`${basename(f).padEnd(16)} ${String(size(f)).padStart(6)} -> ${String(Buffer.byteLength(body)).padStart(6)} bytes`);
  if (!split) console.log('MEMORY.md already split; left as is');
  if (dry) process.exit(0);
  const backup = join(claudeDir, 'backups', `context-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(backup, { recursive: true });
  for (const [f] of writes) if (existsSync(f)) copyFileSync(f, join(backup, basename(f)));
  writeFileSync(join(backup, 'PATHS.json'), JSON.stringify(Object.fromEntries(writes.map(([f]) => [basename(f), f])), null, 2));
  for (const [f, body] of writes) writeFileSync(f, body);
  console.log(`applied. backup + original paths: ${backup}`);
}
