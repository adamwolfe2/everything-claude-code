#!/usr/bin/env node
/**
 * packs — folder-activated tool packs.
 *
 * The global setup stays lean (core skills + context7 + aside). Heavier plugins,
 * MCP servers and niche skills load only in the projects that need them.
 * projects.json is the single source: `packs` defines each pack, every project
 * lists the packs it wants, and `auto` rules add packs by stack (e.g. Next -> vercel).
 *
 *   packs list                 show every pack
 *   packs here                 packs active for the current folder
 *   packs sync [--dry-run]     apply projects.json to every registered project, all accounts
 *   packs on <pack...>         add pack(s) to the current project and sync it
 *   packs off <pack...>        remove pack(s) from the current project and sync it
 *
 * Plugins + skills -> <project>/.claude/settings.local.json (git-excluded).
 * MCP servers      -> local scope in each account's .claude.json, via `claude mcp`.
 * Changes apply to the NEXT session started in that folder.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync, appendFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOME = homedir();
const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), '..', 'projects.json');
const CATALOG = join(HOME, '.claude', 'mcp-catalog.json');
const STATE = join(HOME, '.claude', 'state', 'packs-applied.json');
// personal uses the default config dir (no CLAUDE_CONFIG_DIR); the others are explicit.
const ACCOUNTS = [
  { name: 'personal', dir: null },
  { name: 'ma', dir: join(HOME, '.claude-ma') },
  { name: 'aims', dir: join(HOME, '.claude-aims') },
];

const expand = (p) => resolve(p.replace(/^~(?=\/|$)/, HOME));
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const writeJson = (p, data) => {
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, p);
};
const uniq = (xs) => [...new Set(xs)];

const registry = () => readJson(REGISTRY, null) ?? fail(`missing ${REGISTRY}`);
function fail(msg) { console.error(`packs: ${msg}`); process.exit(1); }

/** Packs a project gets: its explicit list plus any auto rule its stack matches. */
export function desiredPacks(project, packDefs) {
  const auto = Object.entries(packDefs)
    .filter(([, def]) => def.auto?.stack && new RegExp(def.auto.stack, 'i').test(project.stack ?? ''))
    .map(([name]) => name);
  const explicit = project.packs ?? [];
  const optedOut = new Set(project.packs_off ?? []);
  return uniq([...explicit, ...auto]).filter((n) => !optedOut.has(n));
}

/** Flatten pack names into the concrete plugins / skills / MCP servers they load. */
export function resolveItems(packNames, packDefs) {
  const unknown = packNames.filter((n) => !packDefs[n]);
  if (unknown.length) fail(`unknown pack(s): ${unknown.join(', ')}`);
  const pick = (k) => uniq(packNames.flatMap((n) => packDefs[n][k] ?? []));
  return { plugins: pick('plugins'), skills: pick('skills'), mcp: pick('mcp') };
}

const projectForCwd = (reg, cwd = process.cwd()) =>
  reg.projects
    .map((p) => ({ p, abs: expand(p.path) }))
    .filter(({ abs }) => cwd === abs || cwd.startsWith(`${abs}/`))
    .sort((a, b) => b.abs.length - a.abs.length)[0];

function ensureGitExcluded(abs) {
  const gitDir = join(abs, '.git');
  if (!existsSync(gitDir) || !lstatSync(gitDir).isDirectory()) return;
  try {
    execFileSync('git', ['-C', abs, 'check-ignore', '-q', '.claude/settings.local.json']);
  } catch (error) {
    if (error.status !== 1) throw error; // 1 = not ignored; anything else is a real git failure
    appendFileSync(join(gitDir, 'info', 'exclude'), '\n.claude/settings.local.json\n');
  }
}

function applySettings(abs, items, prev, dryRun) {
  const file = join(abs, '.claude', 'settings.local.json');
  const cur = readJson(file, {});
  const plugins = { ...(cur.enabledPlugins ?? {}) };
  for (const p of prev.plugins ?? []) if (!items.plugins.includes(p)) delete plugins[p];
  for (const p of items.plugins) plugins[p] = true;
  const skills = { ...(cur.skillOverrides ?? {}) };
  for (const s of prev.skills ?? []) if (!items.skills.includes(s)) delete skills[s];
  for (const s of items.skills) skills[s] = 'on';
  const next = { ...cur, enabledPlugins: plugins, skillOverrides: skills };
  if (!Object.keys(plugins).length) delete next.enabledPlugins;
  if (!Object.keys(skills).length) delete next.skillOverrides;
  if (JSON.stringify(next) === JSON.stringify(cur)) return false;
  if (dryRun) return true;
  if (!Object.keys(next).length && !existsSync(file)) return false;
  writeJson(file, next);
  ensureGitExcluded(abs);
  return true;
}

function claudeMcp(account, cwd, args) {
  const env = { ...process.env };
  if (account.dir) env.CLAUDE_CONFIG_DIR = account.dir;
  else delete env.CLAUDE_CONFIG_DIR;
  return execFileSync('claude', ['mcp', ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

function applyMcp(abs, items, prev, catalog, dryRun) {
  const add = items.mcp.filter((m) => !(prev.mcp ?? []).includes(m));
  const remove = (prev.mcp ?? []).filter((m) => !items.mcp.includes(m));
  const missing = add.filter((m) => !catalog[m]);
  if (missing.length) fail(`MCP server(s) not in ${CATALOG}: ${missing.join(', ')}`);
  if (dryRun || (!add.length && !remove.length)) return { add, remove };
  for (const account of ACCOUNTS) {
    for (const m of remove) {
      try { claudeMcp(account, abs, ['remove', '-s', 'local', m]); }
      catch (error) { console.warn(`  [${account.name}] remove ${m}: ${error.stderr?.toString().trim() || error.message}`); }
    }
    for (const m of add) {
      const { description, tools, ...def } = catalog[m];
      claudeMcp(account, abs, ['add-json', '-s', 'local', m, JSON.stringify(def)]);
    }
  }
  return { add, remove };
}

function checkSettingsLinks() {
  const main = join(HOME, '.claude', 'settings.json');
  for (const a of ACCOUNTS.filter((x) => x.dir)) {
    const f = join(a.dir, 'settings.json');
    if (existsSync(f) && !lstatSync(f).isSymbolicLink()) {
      console.warn(`WARNING: ${f} is a regular file again (something rewrote the link). Diff it against ${main}, then: ln -sf ${main} ${f}`);
    }
  }
}

function sync({ only, dryRun }) {
  const reg = registry();
  const packDefs = reg.packs ?? {};
  const catalog = readJson(CATALOG, { servers: {} }).servers ?? {};
  const state = readJson(STATE, {});
  const nextState = { ...state };
  for (const project of reg.projects) {
    const abs = expand(project.path);
    if (only && abs !== only) continue;
    if (!existsSync(abs)) continue;
    const names = desiredPacks(project, packDefs);
    const items = resolveItems(names, packDefs);
    const prev = state[abs] ?? {};
    const changed = applySettings(abs, items, prev, dryRun);
    const mcp = applyMcp(abs, items, prev, catalog, dryRun);
    if (changed || mcp.add.length || mcp.remove.length) {
      const mcpNote = [...mcp.add.map((m) => `+${m}`), ...mcp.remove.map((m) => `-${m}`)].join(' ');
      console.log(`${dryRun ? '[dry] ' : ''}${project.id}: ${names.join(', ') || '(none)'}${mcpNote ? `  mcp ${mcpNote}` : ''}`);
    }
    nextState[abs] = { packs: names, ...items };
  }
  if (!dryRun) writeJson(STATE, nextState);
  checkSettingsLinks();
}

function here() {
  const reg = registry();
  const hit = projectForCwd(reg);
  if (!hit) return console.log(`No registered project here. Global core only. Register with: packs on <pack>`);
  const names = desiredPacks(hit.p, reg.packs ?? {});
  const items = resolveItems(names, reg.packs ?? {});
  console.log(`${hit.p.id} (${hit.abs})\npacks:   ${names.join(', ') || '(none)'}\nplugins: ${items.plugins.join(', ') || '-'}\nskills:  ${items.skills.join(', ') || '-'}\nmcp:     ${items.mcp.join(', ') || '-'}`);
}

function toggle(names, on) {
  if (!names.length) fail(`usage: packs ${on ? 'on' : 'off'} <pack...>`);
  const reg = registry();
  resolveItems(names, reg.packs ?? {}); // validates names
  const cwd = process.cwd();
  let hit = projectForCwd(reg, cwd);
  if (!hit) {
    if (!on) fail('current folder is not a registered project');
    let root = cwd;
    try { root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd }).toString().trim(); }
    catch (error) { console.warn(`not a git repo, registering ${cwd} (${error.message.split('\n')[0]})`); }
    const project = { id: root.split('/').pop(), path: root.replace(HOME, '~'), packs: [] };
    reg.projects = [...reg.projects, project];
    hit = { p: project, abs: root };
  }
  const cur = hit.p.packs ?? [];
  const off = hit.p.packs_off ?? [];
  const updated = on
    ? { ...hit.p, packs: uniq([...cur, ...names]), packs_off: off.filter((n) => !names.includes(n)) }
    : { ...hit.p, packs: cur.filter((n) => !names.includes(n)), packs_off: uniq([...off, ...names]) };
  if (!updated.packs_off.length) delete updated.packs_off;
  writeJson(REGISTRY, { ...reg, projects: reg.projects.map((p) => (p === hit.p ? updated : p)) });
  sync({ only: hit.abs, dryRun: false });
  console.log(`Done. Start a new session in ${hit.abs} to load it.`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/packs')) {
  switch (cmd) {
    case 'list': {
      const defs = registry().packs ?? {};
      for (const [n, d] of Object.entries(defs)) console.log(`${n.padEnd(12)} ${d.why}${d.auto ? `  (auto: stack ~ /${d.auto.stack}/)` : ''}`);
      break;
    }
    case 'here': here(); break;
    case 'sync': sync({ only: null, dryRun: rest.includes('--dry-run') }); break;
    case 'on': toggle(rest, true); break;
    case 'off': toggle(rest, false); break;
    default: console.log('usage: packs [list|here|sync [--dry-run]|on <pack...>|off <pack...>]');
  }
}
