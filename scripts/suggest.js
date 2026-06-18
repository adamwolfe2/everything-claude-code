#!/usr/bin/env node
/**
 * suggest — the proactive next-best-action recommender.
 *
 * Answers "what should I do / ask / try / say next?" from REAL state, not generic tips.
 * Runs at SessionStart (fast, file-only) and on demand via /suggest (--live adds gh/network).
 *
 * Each suggestion ends with the EXACT thing to say, so Adam never hunts for the word.
 * Categories: DO (pending work) · ASK (query state) · TRY (dormant capability) · LOOP (keep the flywheel fed).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const HOME = os.homedir();
const CLAUDE = path.join(HOME, '.claude');
const ECC = path.join(__dirname, '..');
const LIVE = process.argv.includes('--live');

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const sh = (c) => { try { return cp.execSync(c, { encoding: 'utf8', timeout: 8000, stdio: ['ignore','pipe','ignore'] }).trim(); } catch { return ''; } };
const daysSince = (p) => { try { return (Date.now() - fs.statSync(p).mtimeMs) / 86400000; } catch { return Infinity; } };

const S = []; // {cat, urgency, text, say}
const add = (cat, urgency, text, say) => S.push({ cat, urgency, text, say });

// ---- DO: pending work in the current repo + harness --------------------------
const cwd = process.cwd();
const branch = sh(`git -C "${cwd}" rev-parse --abbrev-ref HEAD 2>/dev/null`);
if (branch) {
  const dirty = sh(`git -C "${cwd}" status --porcelain`).split('\n').filter(Boolean).length;
  if (dirty > 0) add('DO', 9, `${dirty} uncommitted file(s) on ${branch}.`, 'say "cap" to verify+commit+push');
  const upstream = sh(`git -C "${cwd}" rev-parse --abbrev-ref @{u} 2>/dev/null`);
  if (!upstream && branch !== 'main' && branch !== 'master') add('DO', 6, `Branch ${branch} has no upstream (unpushed).`, 'say "push"');
}

// unreviewed evolve / overnight / loop proposals
for (const f of (exists(path.join(CLAUDE,'overnight')) ? fs.readdirSync(path.join(CLAUDE,'overnight')) : [])) {
  if (f.endsWith('.md') && daysSince(path.join(CLAUDE,'overnight',f)) < 8) {
    add('DO', 8, `Unreviewed harness proposals: overnight/${f}.`, 'say "evolve" to apply eval-gated winners');
    break;
  }
}

// background watcher alerts
const alerts = read(path.join(CLAUDE,'bg-alerts.md')).trim().split('\n').filter((l)=>l.startsWith('  ')).slice(-3);
if (alerts.length) add('DO', 7, `bg-watch flagged: ${alerts[alerts.length-1].trim()}`, 'review ~/.claude/bg-alerts.md');

// open research-queue items
const openItems = (read(path.join(CLAUDE,'research-queue.md')).match(/^- \[ \]/gm) || []).length;
if (openItems >= 3) add('DO', 5, `${openItems} open items in research-queue.`, 'say "run loop-harness" to draft proposals for them');

// ---- ASK: query state Adam might want -----------------------------------------
add('ASK', 3, 'Cross-project status without grepping.', 'ask "what changed in <project>?" (harness-state MCP)');
if (LIVE) {
  // best-effort: which repos have open PRs
  const prRepos = ['adamwolfe2/trackr','adamwolfe2/cursive'].map((r) => {
    const n = sh(`gh pr list --repo ${r} --state open --json number --jq 'length' 2>/dev/null`);
    return n && n !== '0' ? `${r.split('/')[1]}:${n}` : '';
  }).filter(Boolean);
  if (prRepos.length) add('DO', 7, `Open PRs — ${prRepos.join(', ')}.`, 'say "team" to run parallel-review on one');
}

// ---- TRY: a dormant/underused capability (rotates by day) ----------------------
const caps = [
  ['parallel-review','say "team" before your next /cap — claude+security+codex review, verified'],
  ['eval-fix-loop','next red suite: say "fixloop" — an agent drives it green in a worktree'],
  ['harness-evolve','say "evolve" to compound the setup on this week\'s telemetry'],
  ['/overnight','queue tonight: say "overnight" — semi-autonomous harness work, morning report'],
  ['/bg-watch','say "watch" to keep an eye on PRs/CI while you work'],
  ['harness-state MCP','ask "what do we know about <topic>?" instead of opening MEMORY'],
  ['ci-agent','say "set up the CI agent on <repo>" so every PR auto-reviews'],
];
const telem = read(path.join(CLAUDE,'telemetry.jsonl')).slice(-20000);
const leastUsed = caps.map(([k,say]) => [k, say, (telem.match(new RegExp(k.replace(/[^a-z]/gi,''),'gi'))||[]).length])
  .sort((a,b)=>a[2]-b[2]);
const pick = leastUsed[new Date().getDate() % Math.min(3, leastUsed.length)];
add('TRY', 4, `Underused: ${pick[0]}.`, pick[1]);

// ---- LOOP: keep the flywheel fed ----------------------------------------------
if (read(path.join(CLAUDE,'mistakes.jsonl')).trim() === '') {
  add('LOOP', 5, 'mistakes.jsonl is EMPTY — the loop has no fuel.', 'after your next bug fix, say "log-mistake"');
}
const digestAge = Math.min(...(exists(path.join(CLAUDE,'logs')) ? fs.readdirSync(path.join(CLAUDE,'logs')).filter((f)=>f.startsWith('digest-')).map((f)=>daysSince(path.join(CLAUDE,'logs',f))) : [Infinity]));
if (digestAge > 8) add('LOOP', 4, `Last /digest was ${digestAge===Infinity?'never':Math.round(digestAge)+'d ago'}.`, 'say "digest" to mine this week\'s telemetry');

// unrouted high-value tools (coverage)
const cov = sh(`node "${path.join(ECC,'scripts','coverage-guard.js')}" 2>/dev/null`);
const unroutedCmd = (cov.match(/UNROUTED commands \((\d+)\)/) || [])[1];
if (unroutedCmd && +unroutedCmd > 0) add('LOOP', 2, `${unroutedCmd} commands have no router entry.`, 'say "route more" to wire the high-value ones');

// ---- render -------------------------------------------------------------------
S.sort((a,b)=>b.urgency-a.urgency);
const top = S.slice(0, 6);
if (!top.length) process.exit(0);
const out = ['[suggest] Proactive next moves (say the word — you needn\'t know the tool):'];
for (const s of top) out.push(`  ${s.cat.padEnd(4)} ${s.text}  →  ${s.say}`);
out.push('  (or just describe what you want — the router maps it.)');
process.stdout.write(out.join('\n') + '\n');
