#!/usr/bin/env node
/**
 * UserPromptSubmit hook: the self-training intent router.
 *
 * Reads routing.json and, for each of Adam's prompts, surfaces the best-matching
 * tool as additionalContext — so the RIGHT tool appears every time without Adam
 * (or Claude) having to memorize 80+ skills/commands/words.
 *
 * Also logs every match to routing-log.jsonl. weekly-evolve reads that log to find
 * misroutes (suggested != used) and proposes routing.json edits — the router trains itself.
 *
 * Silent when nothing matches (most casual messages). Never blocks.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROUTING = path.join(__dirname, '..', '..', 'routing.json');
const LOG = path.join(os.homedir(), '.claude', 'routing-log.jsonl');

// bare affirmatives / steers — never route these (they refer to a prior proposal)
const SKIP = new Set(['yes','go','ship','do it','lgtm','proceed','run it','sounds good','ok','okay','sure','y','yep','steer','no','wait','status','next','dash','health','push','done']);

let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(d); } catch { process.exit(0); }
  const prompt = (input.prompt || input.user_prompt || '').toString();
  const lc = prompt.toLowerCase().trim();
  if (!lc || lc.length < 4 || SKIP.has(lc)) process.exit(0);

  let map;
  try { map = JSON.parse(fs.readFileSync(ROUTING, 'utf8')); } catch { process.exit(0); }
  const routes = (map && map.routes) || [];

  // score each route by how many of its patterns appear; longer patterns = more specific
  const scored = [];
  for (const r of routes) {
    let score = 0, hits = [];
    for (const p of r.patterns || []) {
      if (lc.includes(p)) { score += 1 + Math.min(p.length / 12, 2); hits.push(p); }
    }
    if (score > 0) scored.push({ r, score, hits });
  }
  if (!scored.length) process.exit(0);

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 2);

  // build the surfaced hint
  const lines = top.map(({ r }) => {
    const dormant = r.tier === 'dormant' ? ' (not built yet — offer to build it)' : '';
    return `• ${r.tool}${dormant} — ${r.why}`;
  });
  const msg = `[router] This looks like it wants:\n${lines.join('\n')}\nUse it if it fits; this is a data-driven suggestion from routing.json, not a hard rule.`;

  // log the signal for self-training (best-effort)
  try {
    const rec = {
      ts: new Date().toISOString(),
      prompt: lc.slice(0, 120),
      matched: top.map((t) => t.r.id),
      suggested: top.map((t) => t.r.tool),
    };
    fs.appendFileSync(LOG, JSON.stringify(rec) + '\n');
  } catch {}

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg },
  }));
  process.exit(0);
});
