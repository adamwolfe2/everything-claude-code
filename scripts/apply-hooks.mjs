#!/usr/bin/env node
// Install config/hooks.json into ~/.claude/settings.json (the one file all 3 accounts symlink to).
// Keeps every entry tagged `agent_nook_event` (written by the Pocket/agent-nook app) untouched,
// replaces all other hook entries, and backs up the old file first.
//   node scripts/apply-hooks.mjs --dry-run   show what would change
//   node scripts/apply-hooks.mjs             apply (backup in ~/.claude/backups/)
import { readFileSync, writeFileSync, renameSync, mkdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = join(dirname(fileURLToPath(import.meta.url)), '..', 'config', 'hooks.json');
const SETTINGS = realpathSync(join(homedir(), '.claude', 'settings.json'));

export function mergeHooks(current, wanted) {
  const events = new Set([...Object.keys(current), ...Object.keys(wanted)]);
  const merged = {};
  for (const ev of events) {
    const nook = (current[ev] ?? []).filter((e) => e.agent_nook_event);
    const entries = [...(wanted[ev] ?? []), ...nook];
    if (entries.length) merged[ev] = entries;
  }
  return merged;
}

const describe = (hooks) => Object.entries(hooks).flatMap(([ev, arr]) =>
  arr.filter((e) => !e.agent_nook_event).flatMap((e) => e.hooks.map((h) => `${ev} [${e.matcher}] ${h.command ?? h.url}`)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));
  const wanted = JSON.parse(readFileSync(CONFIG, 'utf8')).hooks;
  const next = mergeHooks(settings.hooks ?? {}, wanted);
  const before = new Set(describe(settings.hooks ?? {}));
  const after = new Set(describe(next));
  for (const l of before) if (!after.has(l)) console.log(`- ${l}`);
  for (const l of after) if (!before.has(l)) console.log(`+ ${l}`);
  if (process.argv.includes('--dry-run')) process.exit(0);
  const backupDir = join(homedir(), '.claude', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const backup = join(backupDir, `settings.json.${new Date().toISOString().replace(/[:.]/g, '-')}`);
  writeFileSync(backup, readFileSync(SETTINGS));
  const tmp = `${SETTINGS}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ ...settings, hooks: next }, null, 2)}\n`);
  renameSync(tmp, SETTINGS);
  console.log(`applied. backup: ${backup}`);
}
