#!/usr/bin/env node
// Stop hook (pilot): after UI changes, render the dev page at 390x844 and 1440x900 and block once per diff
// if it finds layout defects, axe serious/critical violations, or house-rule breaks (dark bg, emoji, non-Lucide icons).
// Runs only when: the repo's projects.json entry lists pack "ui-gate", the diff touches UI files, and a dev server
// answers (.claude/dev-url, else localhost 3000/3001/5173). Silent when clean. Any failure allows the stop.
// Browser: vendored agent-browser 0.38.1 (npm ci --prefix vendor), isolated --session, never --profile/--auto-connect.
// UIGATE_MODE=log records without blocking. UIGATE_PROJECTS / UIGATE_STATE override paths (tests).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const AB = path.join(ROOT, 'vendor', 'node_modules', '.bin', 'agent-browser');
const DETECT = path.join(ROOT, 'vendor', 'ui-review', 'detect.js');
const AXE = path.join(ROOT, 'vendor', 'node_modules', 'axe-core', 'axe.min.js');
const PROJECTS = process.env.UIGATE_PROJECTS || path.join(ROOT, 'projects.json');
const STATE = process.env.UIGATE_STATE || path.join(os.homedir(), '.claude', 'state');
const UI_FILE = /\.(tsx|jsx|css|scss)$|(^|\/)tailwind\.config\.|(^|\/)public\/.*\.(png|jpe?g|svg|webp|gif|avif)$/;
const CAP = 5;

const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const expand = (p) => { const abs = p.replace(/^~(?=$|\/)/, os.homedir()); try { return fs.realpathSync(abs); } catch { return abs; } };

function project(repo) {
  const reg = JSON.parse(fs.readFileSync(PROJECTS, 'utf8'));
  return reg.projects.map((p) => ({ p, abs: expand(p.path) }))
    .filter(({ abs }) => repo === abs || repo.startsWith(`${abs}/`))
    .sort((a, b) => b.abs.length - a.abs.length)[0]?.p;
}

// UI files in the working tree, untracked, or committed in the last 20 min (a /cap before stop still counts).
function uiChanges(repo) {
  const files = new Set([
    ...git(repo, 'diff', '--name-only', 'HEAD').split('\n'),
    ...git(repo, 'ls-files', '--others', '--exclude-standard').split('\n'),
    ...git(repo, 'log', '--since=20.minutes', '--name-only', '--format=').split('\n'),
  ].filter((f) => f && UI_FILE.test(f)));
  const h = crypto.createHash('sha1').update(git(repo, 'rev-parse', 'HEAD'));
  for (const f of [...files].sort()) {
    h.update(f);
    try { h.update(fs.readFileSync(path.join(repo, f))); } catch { h.update('deleted'); }
  }
  return { files: [...files], hash: h.digest('hex').slice(0, 16) };
}

// Port probe, not a fetch: a cold `next dev` compile can take far longer than any sane probe timeout.
const answers = (u) => new Promise((resolve) => {
  const { hostname, port, protocol } = new URL(u);
  const sock = require('net').connect(Number(port) || (protocol === 'https:' ? 443 : 80), hostname);
  const done = (ok) => { sock.destroy(); resolve(ok); };
  sock.setTimeout(2000, () => done(false));
  sock.once('connect', () => done(true));
  sock.once('error', () => done(false));
});

async function devUrl(repo) {
  let urls = ['http://localhost:3000/', 'http://localhost:3001/', 'http://localhost:5173/'];
  try { urls = [fs.readFileSync(path.join(repo, '.claude', 'dev-url'), 'utf8').trim()]; } catch { /* no pinned url */ }
  for (const u of urls) if (await answers(u)) return u;
  return null;
}

// Extra page checks (not in detect.js): real horizontal scroll, dark background, emoji, non-Lucide icons.
const EXTRA = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  const clip = (el) => /hidden|clip/.test(getComputedStyle(el).overflowX);
  const scrollable = !clip(document.documentElement) && !clip(document.body);
  let bg = null;
  for (const el of [document.body, document.documentElement]) { const c = getComputedStyle(el).backgroundColor; if (!/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) { bg = c; break; } }
  const [r, g, b] = (bg || 'rgb(255,255,255)').match(/\\d+/g).map(Number);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const emoji = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode() && emoji.length < 5) { const t = w.currentNode; if (/\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F/u.test(t.data) && t.parentElement && vis(t.parentElement)) emoji.push(sel(t.parentElement) + ' "' + t.data.trim().slice(0, 30) + '"'); }
  const icons = [...document.querySelectorAll('svg')].filter((s) => { const r = s.getBoundingClientRect(); return vis(s) && r.width <= 32 && r.height <= 32 && !/lucide/.test(s.getAttribute('class') || ''); })
    .slice(0, 5).map((s) => (s.parentElement ? sel(s.parentElement) + ' > ' : '') + 'svg ' + Math.round(s.getBoundingClientRect().width) + 'px');
  return JSON.stringify({ scrollable, bg, dark: lum < 0.25, emoji, icons });
})()`;

function ab(session, args, input) {
  const r = spawnSync(AB, ['--session', session, ...args], {
    input, encoding: 'utf8', timeout: args[0] === 'open' ? 60000 : 20000, maxBuffer: 8 << 20,
    env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: '55000' }, // slow first compile / heavy pages
  });
  if (r.status !== 0) throw new Error(`agent-browser ${args[0]}: ${(r.stderr || r.error || '').toString().trim().slice(0, 200)}`);
  return r.stdout;
}
const evalJson = (session, src) => { const out = JSON.parse(ab(session, ['eval', '--stdin'], src)); return typeof out === 'string' ? JSON.parse(out) : out; };

const HIDDEN = /sr-only|visually-hidden|screen-reader/;
// Findings are [category, item] pairs; the item's quoted text excerpt is dropped from the identity key
// so rotating copy (carousels, marquees) doesn't read as a new defect.
function layoutFindings(d, x, width) {
  const out = [];
  const add = (cat, items, fmt) => { for (const i of items || []) if (!HIDDEN.test(JSON.stringify(i))) out.push([cat, fmt(i)]); };
  const any = (o) => o.el || o.src || JSON.stringify(o);
  if (d.horizontalScroll && x.scrollable) add('horizontal scroll', d.offenders.length ? d.offenders : [{ el: 'page' }], (o) => `${o.el}${o.right ? ` to ${o.right}px` : ''}`);
  if (d.viewportMetaMissing && width < 500) out.push(['no <meta name=viewport>', 'page']);
  add('clipped text', d.clippedText, any);
  // ponytail: same-selector pairs are stacked/animated list items (chat mocks, carousels); a real overlap between
  // two identical siblings is missed. Compare bounding boxes across passes if that ever matters.
  const bare = (sel) => sel.replace(/\s*\("[^"]*"\)/g, '');
  add('overlapping text', (d.overlaps || []).filter((o) => bare(o.a) !== bare(o.b)), (o) => `${o.a} / ${o.b}`);
  add('broken images', d.brokenImages, any);
  add('distorted images', d.distortedImages, any);
  add('media overflow', d.overflowingMedia, any);
  add('wrapped controls', d.wrappedControls, any);
  add('placeholder text', d.placeholderText, any);
  if (width < 500) {
    add('tap targets too small', d.tinyTapTargets, (o) => `${o.el} ${o.size || ''}`.trim());
    add('text too small', d.smallText, any);
  }
  return out;
}
const keyOf = (where, [cat, item]) => `${where}|${cat}|${item.replace(/\s*\("[^"]*"\)/g, '').replace(/ \d+x\d+$| to \d+px$| \(\d+x, e\.g\..*$/, '')}`;

function format(findings) {
  const by = new Map();
  for (const { where, cat, item } of findings) {
    const k = `${where}\u0000${cat}`;
    by.set(k, [...(by.get(k) || []), item]);
  }
  const rows = new Map();
  for (const [k, items] of by) {
    const [where, cat] = k.split('\u0000');
    const txt = `${cat}: ${items.slice(0, CAP).join(', ')}${items.length > CAP ? ` (+${items.length - CAP})` : ''}`;
    rows.set(where, [...(rows.get(where) || []), txt]);
  }
  return [...rows].map(([where, txts]) => `${where}: ${txts.join(' · ')}`);
}

async function run(input) {
  if (input.stop_hook_active) return { decision: 'allow', why: 'stop_hook_active' };
  const cwd = input.cwd || process.cwd();
  let repo;
  try { repo = git(cwd, 'rev-parse', '--show-toplevel').trim(); } catch { return { decision: 'allow', why: 'not a git repo' }; }
  const proj = project(fs.realpathSync(repo));
  if (!proj || !(proj.packs || []).includes('ui-gate')) return { decision: 'allow', why: 'pack off' };
  const { files, hash } = uiChanges(repo);
  if (!files.length) return { decision: 'allow', why: 'no ui changes' };
  const stateFile = path.join(STATE, 'uigate', `${proj.id}.json`);
  let st = {};
  try { st = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* first run */ }
  if (st.hash === hash) return { decision: 'allow', why: 'diff already checked' };
  const save = (extra) => { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify({ ...st, hash, at: new Date().toISOString(), ...extra })); };
  save(); // once per diff, even if the check below fails
  if (!fs.existsSync(AB)) return { decision: 'allow', why: 'agent-browser not installed (npm ci --prefix vendor)' };
  const url = await devUrl(repo);
  if (!url) return { decision: 'allow', why: 'no dev server' };

  const session = `uigate-${process.pid}`;
  const found = [];
  const push = (where, pairs) => { for (const p of pairs) found.push({ where, cat: p[0], item: p[1], key: keyOf(where, p) }); };
  try {
    ab(session, ['open', url]);
    let x;
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      ab(session, ['set', 'viewport', String(w), String(h)]);
      ab(session, ['wait', '400']);
      const first = layoutFindings(evalJson(session, fs.readFileSync(DETECT, 'utf8')), { scrollable: true }, w);
      ab(session, ['wait', '700']);
      x = evalJson(session, EXTRA);
      const second = layoutFindings(evalJson(session, fs.readFileSync(DETECT, 'utf8')), x, w);
      const stable = new Set(first.map((f) => keyOf(w, f)));
      push(`${w}px`, second.filter((f) => stable.has(keyOf(w, f)))); // animation flicker shows up in one pass only
    }
    const allowDark = /dark[^,.;]*by design|dark\/gold/i.test((proj.conventions || []).join(' '));
    if (x.dark && !allowDark) push('page', [['dark background (house rule is light)', x.bg]]);
    push('page', x.emoji.map((e) => ['emoji in UI copy (use Lucide icons)', e]));
    push('page', x.icons.map((i) => ['non-Lucide icons', i]));
    const axe = evalJson(session, `${fs.readFileSync(AXE, 'utf8')}\n;(async () => { const r = await axe.run(document, { resultTypes: ['violations'] });
      return JSON.stringify(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: (v.nodes[0] && v.nodes[0].target.join(' ')) || '' }))); })()`);
    push('page', axe.map((v) => [`axe ${v.impact}`, `${v.id} (${v.n}x, e.g. ${v.t.slice(0, 40)})`]));
  } finally {
    spawnSync(AB, ['--session', session, 'close'], { timeout: 10000, stdio: 'ignore' });
  }

  // Only findings absent from this URL's previous render block; the first render is the baseline.
  const baseline = (st.seen || {})[url];
  // Baseline accumulates: anything this URL has ever shown is known (cap keeps state small).
  save({ seen: { ...(st.seen || {}), [url]: [...new Set([...(baseline || []), ...found.map((f) => f.key)])].slice(-2000) } });
  const fresh = baseline ? found.filter((f) => !baseline.includes(f.key)) : [];
  const meta = { url, files: files.length, total: found.length, fresh: fresh.length };
  if (!baseline) return { decision: 'allow', why: 'baseline recorded', ...meta, reason: format(found).join('\n') };
  if (!fresh.length) return { decision: 'allow', why: 'no new findings', ...meta };
  const reason = `[ui-gate] Rendered ${url} after your UI changes. New since the last render:\n${format(fresh).join('\n')}\nFix these, or say in one line why each is intended. This check runs once per diff.`.slice(0, 3500);
  return { decision: process.env.UIGATE_MODE === 'log' ? 'would_block' : 'block', why: 'new findings', ...meta, reason };
}

function log(entry) {
  try {
    fs.mkdirSync(STATE, { recursive: true });
    fs.appendFileSync(path.join(STATE, 'uigate.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
  } catch { /* logging must never break a stop */ }
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', async () => {
    const t0 = Date.now();
    let input = {};
    try {
      input = JSON.parse(raw || '{}');
      const { reason, ...rest } = await run(input);
      log({ session: input.session_id, cwd: input.cwd, ms: Date.now() - t0, ...rest, findings: reason });
      if (rest.decision === 'block') process.stdout.write(JSON.stringify({ decision: 'block', reason }));
    } catch (error) {
      log({ session: input.session_id, cwd: input.cwd, decision: 'allow', why: `error: ${error.message}` });
    }
    process.exit(0);
  });
}

module.exports = { layoutFindings, UI_FILE };
