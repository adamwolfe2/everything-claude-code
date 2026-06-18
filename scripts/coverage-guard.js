#!/usr/bin/env node
/**
 * coverage-guard: keeps the intent router complete.
 *
 * Lists every skill/command/workflow and cross-refs routing.json — reports any
 * capability with NO routing entry ("unrouted": exists but no situation maps to it)
 * so new tools never silently rot. Also flags dormant routes (tier=dormant).
 *
 * Run by /digest + weekly-evolve. Output is plain text for a model to act on.
 *   node scripts/coverage-guard.js
 */
const fs = require('fs');
const path = require('path');

const ECC = path.join(__dirname, '..');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const ls = (p) => { try { return fs.readdirSync(p); } catch { return []; } };

const map = (() => { try { return JSON.parse(read(path.join(ECC, 'routing.json'))); } catch { return { routes: [] }; } })();
const routedBlob = (map.routes || []).map((r) => (r.tool + ' ' + r.id)).join(' ').toLowerCase();
const isRouted = (name) => {
  const base = name.replace(/\.(md|js)$/, '').toLowerCase();
  return routedBlob.includes(base);
};

const skills = ls(path.join(ECC, 'skills')).filter((f) => !f.startsWith('.'));
const commands = ls(path.join(ECC, 'commands')).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''));
const workflows = ls(path.join(ECC, 'workflows')).filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''));

const unrouted = { skills: [], commands: [], workflows: [] };
for (const s of skills) if (!isRouted(s)) unrouted.skills.push(s);
for (const c of commands) if (!isRouted(c)) unrouted.commands.push(c);
for (const w of workflows) if (!isRouted(w)) unrouted.workflows.push(w);

const dormant = (map.routes || []).filter((r) => r.tier === 'dormant').map((r) => r.id);

console.log('=== ROUTING COVERAGE ===');
console.log(`routes: ${(map.routes || []).length} · skills: ${skills.length} · commands: ${commands.length} · workflows: ${workflows.length}`);
console.log('');
console.log(`UNROUTED skills (${unrouted.skills.length}): ${unrouted.skills.join(', ') || 'none'}`);
console.log(`UNROUTED commands (${unrouted.commands.length}): ${unrouted.commands.join(', ') || 'none'}`);
console.log(`UNROUTED workflows (${unrouted.workflows.length}): ${unrouted.workflows.join(', ') || 'none'}`);
console.log(`DORMANT routes (${dormant.length}): ${dormant.join(', ') || 'none'}`);
console.log('');
console.log('ACTION: for high-value unrouted tools, add a route to routing.json (intent patterns + tool + why).');
console.log('Many unrouted entries are fine (sub-skills, internal). Route only the ones Adam would reach for by intent.');
