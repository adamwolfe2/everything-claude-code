import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { Chip } from '../types'

import { registerHq, registerHqCommand } from './hq'

const chips = atom({ plugin: 'autopilot', key: 'chips' } as const, [])

const CHECK =
  /\b(npm|pnpm|yarn|bun|npx)\s+(run\s+)?(test|build|lint|typecheck|check|verify|vitest|tsc|playwright)\b|\b(vitest|tsc|pytest|eslint|cargo test|go test)\b|scripts\/verify/
const LOOK = /screenshot|playwright|browser-harness|lighthouse|design-qa/
const LOOK_TOOL = /chrome|aside|computer-use|screenshot/i
const UI_FILE = /\.(tsx|jsx|css|scss|html|vue|svelte|astro)$/
const EDIT_TOOL = /^(Edit|Write|MultiEdit|NotebookEdit)$/
const RUN_TOOL = 'mcp__autopilot__run'
const CTX_NUDGE = 55
const CTX_PUSH = 75
const AWAY_MAX = 15
const MISTAKE_NOTE =
  '[mistake-log] This looks like a verified bug fix. Run /log-mistake: root cause, the CLASS of mistake, and one enforceable check that would have caught it.'
const READ_DENY_CHARS = 40_000
const READ_WARN_CHARS = 24_000
const NOT_TEXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico|pdf)$/i
const SOFT_CTX = 400_000
const HARD_CTX = 600_000
const SOFT_READS = 300_000_000
const HARD_READS = 600_000_000
const RULES_MAX = 8_000
const DEV_PORTS = [3000, 5173]
const LOCK_LIVE_MS = 20 * 60_000
const FORMAT_FILE = /\.(tsx?|jsx?|mjs|cjs|css|scss|json)$/
// [config files, binary, args]: the first the repo has both of wins.
// ponytail: a "prettier" key in package.json is not detected; add it if a repo relies on one.
const FORMATTERS: [string[], string, string[]][] = [
  [['biome.json', 'biome.jsonc'], 'biome', ['format', '--write']],
  [['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.mjs', '.prettierrc.yaml', 'prettier.config.js', 'prettier.config.mjs'], 'prettier', ['--write']],
]
const CORRECTION =
  /\b(that'?s not what i|not what i (asked|wanted|meant)|still (broken|not working|wrong)|(didn'?t|doesn'?t) work|you (missed|forgot|ignored|didn'?t))\b/i
const CORRECTION_NOTE =
  'Adam is correcting you. First re-read his original request in this session and state in one line what you got wrong; then fix exactly that; after it is verified, run /log-mistake.'

const HANDOFF = `Write a handoff for a fresh session that will continue this work with none of this conversation.
Markdown, under 400 words, no preamble. Sections:
## Mission (one line)
## Repo and branch (absolute path, branch, last commit if known)
## Done (verified facts only, with the check that proved each)
## In flight (exact files and the state they are in)
## Next steps (ordered, each concrete enough to start without asking)
## Gotchas (traps hit this session, commands that work)
Never present an unfinished item as done.`

const AWAY_START = (goal: string) =>
  `Adam is away from the computer. Keep working without asking anything${goal ? `: ${goal}` : ' on this project'}.
Pick the highest-value next step, do it, verify it with the repo's own checks, and continue.
Hard stops still apply (secrets, deleting tests, destructive or financial actions, pushing to main): note them and skip.
When nothing worthwhile is left and everything is verified, reply with AWAY-DONE and a short summary.`
const AWAY_NEXT =
  'Continue autonomously with the next highest-value step. Do not ask me. Reply AWAY-DONE with a summary when everything is finished and verified.'

const LEFT =
  'Is there anything genuinely left to do on this project? Anything we are missing? Check the spec, git status, open PRs and failing checks; list only real gaps, ranked, then propose the next step.'

// Turns one discovery call into the three client docs plus a CRM record. The
// CRM write is a dry run; Adam approves the --confirm.
const AUDIT = (args: string) => `Run the client audit flow for: ${args || '(nothing given: ask Adam for the client name or call notes, then stop)'}

1. Source. If that names a file, read it. If it is pasted notes, use them. Otherwise find the most recent call with this client through a connected meeting tool (Avoma, Fathom). Never Close: it holds Vendingpreneurs calls, not AM Collective clients. If none is reachable, ask Adam to paste the notes and stop.
2. Facts only. Pull what the client actually said: business, current process and tools, problems and what each costs them, goals, budget, timeline, decision makers. Never invent numbers, proof or quotes; a missing fact stays a marked gap.
3. One Claude Doc titled "<Company> Audit" with three sections: Audit (current state, problems ranked by cost, opportunities), Plan (phases, each with outcome and rough timeline), SOW (scope, deliverables, out of scope, timeline, price, client responsibilities, assumptions). Price only if stated on the call; otherwise "TBD: Adam to set".
4. CRM. Write ~/.claude/audits/<kebab-slug>.json as {"id":"<kebab-slug>","patch":{"company","contact_name","contact_email","status":"proposal","bucket","priority","human_note":"<3-line call summary>","next_action":"Send SOW"}} with only fields you have. Run \`cd ~/am-collective-os && git pull --ff-only && npm run client:upsert -- <that file>\` (a dry run) and show its output. If the pull fails or package.json has no client:upsert script, stop and tell Adam (PR #22 adds it).
5. Reply with the doc link, the dry-run output, and one line: "Say confirm to write the CRM record." Only after Adam says confirm, re-run with --confirm.`

// A client site from the proven template, built and checked locally. Creating
// the repo, the Vercel project and DNS waits for Adam's "ship".
const SITE = (args: string) => `Build a client site for: ${args || '(nothing given: ask Adam who the client is, then stop)'}

1. Brief. Collect: client name, what they sell, to whom, the one action the page drives, their site URL (for colours, fonts, logo). Pull facts from that site, the CRM (~/am-collective-os) or a /audit doc for this client. Ask Adam once for anything essential that is missing, then stop.
2. Template. Light brands: ~/amcollective-leads. Only a dark brand: ~/aletto-showcase. Export clean main, never the working tree: \`git -C <template> fetch -q && mkdir ~/<slug>-site && git -C <template> archive origin/main | tar -x -C ~/<slug>-site\`, then git init and set package.json name.
3. Rebrand. Tokens in src/app/globals.css :root (bg, text, accent, gradients, fonts), then remap hard-coded hex and rgba across src with one script; new icon.svg, OG and Twitter images. Update scripts/check-rules.mjs BANNED so the template's brand words fail the build.
4. Copy. Rewrite hero, sections, mockup data and the quiz for this client. Facts only: no invented results, prices, testimonials or client names. Adam's page rules: no em dashes, no eyebrow labels, hero badge or hero stat line, every KPI with a delta, every person a photo, every brand a real logo (never initials).
5. Check. pnpm install, pnpm check:rules, pnpm build, then \`pnpm start -p 3100\` and \`npx playwright screenshot --viewport-size=<w>,900 http://localhost:3100 <file>.png\` at widths 1440 and 390 (viewport, never --full-page: a long page reads back too small), and read both images. Fix until all pass.
6. Stop. Reply with the local path, the screenshots and the check output, then one line: "Say ship to create the private GitHub repo and Vercel project." Only after Adam says ship: gh repo create adamwolfe2/<slug>-site --private, vercel link + deploy under the am-collective team. DNS stays Adam's.`

// A system prompt section: Adam forgets command names, so Claude picks them and says which.
const CATALOG = `# Autopilot commands
Adam forgets command names. You choose them for him. When a request or situation matches a row, open with one line "Using /<name>: <reason>" and run it in the same turn without asking. Do not list this table back to him.

| Situation | Command | How you run it |
|---|---|---|
| Context past ~60%, a long task wrapping up, or Adam asks for a handoff, fresh chat or new session | /next | mcp__autopilot__run action=next, handoff=the full handoff (mission, repo+branch, done with proof, in flight, next steps, gotchas) |
| Adam is stepping away, going to bed, "keep going without me", "don't ask me" | /away | mcp__autopilot__run action=away, goal=the mission |
| "what's left", "are we done", "anything missing" | /left | answer it: spec, git status, open PRs, failing checks; ranked real gaps only |
| 5+ edits, a risky diff, "second opinion", before shipping non-trivial work | /codex | mcp__autopilot__run action=codex, then verify each finding and fix the confirmed ones |
| Any code change, before saying done | /verify | Skill verify; paste real output |
| UI files changed, or Adam sends a screenshot of a visual problem | /design-qa | Skill design-qa, and look at the rendered page yourself before reporting |
| A user-facing flow changed, "test it like a user" | /qa | Skill qa |
| "ship", "push", "commit", "deploy" | /cap | Skill cap |
| Money, auth, RLS, webhooks, migrations, destructive actions | /safe-feature-slice | Skill safe-feature-slice |
| Non-trivial diff before /cap | /parallel-review | Skill parallel-review |
| A bug or failing test | /systematic-debugging | Skill systematic-debugging |
| Waiting on a deploy, CI, a dev server or a long job | wait | mcp__autopilot__wait check=<shell command that exits 0 when ready>, label=<what>; never chain sleep/until/pkill calls yourself |
| Adam asks for status across projects, deploys, PRs or CI | /hq | tell him to type /hq: a live pane of failing/fresh deploys (all 3 Vercel teams), open PRs with CI, and the claude queue |
| Adam had a sales or discovery call, pastes call notes, or asks for an audit, proposal or SOW for a client | /audit | tell him to type /audit <client or notes>: audit + plan + SOW as one Claude Doc, then a CRM dry run he confirms |
| Adam wants a site, landing page or partner page for a client | /site | tell him to type /site <client>: clone of the proven partner-page template, rebranded and checked locally; repo and deploy wait for his "ship" |
| Adam asks what to work on, or a session opens idle in a repo with queued issues | the queue | open GitHub issues labelled \`claude\` are his queue (often filed by his ChatGPT agent with a proposed solution): \`gh issue list --label claude\`, take the top one, close it via the PR |

First-try quality: before building, restate the ask as 2-4 acceptance checks; build to them; prove each (test output, screenshot) before saying done.`

type Route = { id: string; patterns: string[]; tool: string }
type Issue = { number: number; title: string; url: string }
type Budget = 'ok' | 'soft' | 'hard'
type Handoff = { path: string; text: string }

// Session-scoped; a reload or a fresh process starts these over.
const s = {
  edits: 0,
  editsAtReview: 0,
  isUiTouched: false,
  hasLooked: false,
  awayLeft: 0,
  toastedAt: 0,
  routes: [] as Route[],
  routerChips: [] as Chip[],
  queueChips: [] as Chip[],
  home: '',
  pendingFresh: undefined as Handoff | undefined,
  projects: [] as string[],
  loadedProjects: new Set<string>(),
  project: '',
  cacheReads: 0,
  budget: 'ok' as Budget,
  budgetNoted: 'ok' as Budget,
  hasFailedCheck: false,
  isMistakeNudged: false,
  waiting: '',
  warnedCheckouts: new Set<string>(),
}

async function refresh($: EngineInterface) {
  const { context, cost, rateLimits } = await $.session.usage()
  const ctx = Math.round(context.percent ?? 0)
  const tokens = context.tokens ?? 0
  s.budget =
    tokens >= HARD_CTX || s.cacheReads >= HARD_READS
      ? 'hard'
      : tokens >= SOFT_CTX || s.cacheReads >= SOFT_READS
        ? 'soft'
        : 'ok'
  const limit = [...rateLimits].sort((a, b) => b.percentUsed - a.percentUsed)[0]
  const parts = [
    s.project || undefined,
    `ctx ${ctx}%`,
    cost ? `$${cost.usd.toFixed(2)}` : undefined,
    limit ? `${limit.kind} ${Math.round(limit.percentUsed)}%` : undefined,
    s.edits > 0 ? `${s.edits} unverified` : 'verified',
    s.awayLeft > 0 ? `away ${s.awayLeft}` : undefined,
    s.queueChips.length > 0 ? `${s.queueChips.length} queued` : undefined,
    s.waiting ? `waiting: ${s.waiting}` : undefined,
  ]
  $.ui.status(parts.filter(Boolean).join(' · '))

  const own: Chip[] = []
  if (ctx >= CTX_NUDGE) own.push({ label: `/next fresh chat (ctx ${ctx}%)`, command: 'next' })
  if (s.edits > 0) own.push({ label: `/verify ${s.edits} edits`, command: 'verify' })
  if (s.isUiTouched && !s.hasLooked) own.push({ label: '/design-qa UI unseen', command: 'design-qa' })
  if (s.edits - s.editsAtReview >= 5) own.push({ label: '/codex second opinion', command: 'codex' })
  await update($, chips, () => [...own, ...s.routerChips, ...s.queueChips].slice(0, 4))
  return ctx
}

async function saveHandoff($: EngineInterface, text: string): Promise<Handoff> {
  const root = await $.session.root()
  const dir = `${root === s.home ? `${s.home}/.claude` : `${root}/.claude`}/handoffs`
  const path = `${dir}/${new Date(await $.clock.now()).toISOString().replace(/[:.]/g, '-')}.md`
  await $.process.run(['mkdir', '-p', dir])
  await $.fs.write(path, text)
  return { path, text }
}

// A refused connection rejects; that only means no dev server on this port.
async function devServer($: EngineInterface): Promise<string | undefined> {
  for (const port of DEV_PORTS) {
    const url = `http://localhost:${port}`
    const isUp = await $.http.fetch(url).then(
      () => true,
      () => false,
    )
    if (isUp) return url
  }
  return undefined
}

// Sessions all start in ~ and cd later, so the process list cannot tell who works where;
// each edit stamps its checkout with this session's id instead.
// ponytail: a session that ended under 20 min ago still counts as live; it costs one held edit.
async function checkoutClash($: EngineInterface, file: string): Promise<string | undefined> {
  const run = await $.process.run(['git', '-C', file.slice(0, file.lastIndexOf('/')) || '/', 'rev-parse', '--show-toplevel'], {
    timeoutMs: 5_000,
  })
  if (run.exitCode !== 0) return undefined
  const top = run.stdout.trim()
  const dir = `${s.home}/.claude/state/autopilot-locks`
  const path = `${dir}/${top.replace(/[^A-Za-z0-9]/g, '_')}.json`
  const [me, now] = [await $.session.id(), await $.clock.now()]
  const other = (await $.fs.exists(path)) ? readLock($, await $.fs.read(path)) : undefined
  await $.process.run(['mkdir', '-p', dir])
  await $.fs.write(path, JSON.stringify({ session: me, at: now }))
  if (!other || other.session === me || now - other.at > LOCK_LIVE_MS || s.warnedCheckouts.has(top)) return undefined
  s.warnedCheckouts.add(top)
  return `[checkout] Another Claude session (${other.session.slice(0, 8)}) edited ${top} ${Math.round((now - other.at) / 60_000)} min ago; two sessions in one checkout overwrite each other. Call EnterWorktree and make this edit there. If that session is finished, retry the edit and it goes through.`
}

// Formats one edited file with the repo's own formatter, as Boris Cherny's PostToolUse hook does.
async function formatFile($: EngineInterface, file: string) {
  if (!FORMAT_FILE.test(file)) return
  const run = await $.process.run(['git', '-C', file.slice(0, file.lastIndexOf('/')) || '/', 'rev-parse', '--show-toplevel'], {
    timeoutMs: 5_000,
  })
  if (run.exitCode !== 0) return
  const top = run.stdout.trim()
  for (const [configs, name, args] of FORMATTERS) {
    const bin = `${top}/node_modules/.bin/${name}`
    if (!(await $.fs.exists(bin))) continue
    const hasConfig = await Promise.all(configs.map(c => $.fs.exists(`${top}/${c}`)))
    if (!hasConfig.includes(true)) continue
    const out = await $.process.run([bin, ...args, file], { cwd: top, timeoutMs: 20_000 })
    if (out.exitCode !== 0) $.ui.log(`autopilot format: ${name} exited ${out.exitCode}: ${out.stderr.slice(0, 160)}`, { to: 'debug' })
    return
  }
}

function readLock($: EngineInterface, text: string): { session: string; at: number } | undefined {
  try {
    return JSON.parse(text) as { session: string; at: number }
  } catch (err) {
    $.ui.log(`autopilot checkout lock unreadable, replacing it: ${String(err)}`, { to: 'debug' })
    return undefined
  }
}

// ponytail: needs the project's own playwright + browsers; no install fallback.
// The first viewport only: a full-page shot of a long page reads back too small to see.
async function autoScreenshot($: EngineInterface): Promise<string | undefined> {
  const url = await devServer($)
  if (url === undefined) return undefined
  const dir = `${s.home}/.claude/screenshots`
  const path = `${dir}/${new Date(await $.clock.now()).toISOString().replace(/[:.]/g, '-')}.png`
  await $.process.run(['mkdir', '-p', dir])
  const run = await $.process.run(['npx', '--no-install', 'playwright', 'screenshot', '--viewport-size=1440,900', url, path], {
    cwd: await $.session.root(),
    timeoutMs: 60_000,
  })
  if (run.exitCode !== 0) {
    $.ui.log(`autopilot screenshot: playwright exited ${run.exitCode}: ${run.stderr.slice(0, 160)}`)
    return undefined
  }
  return `[screenshot] UI changed and checks pass. ${url} captured at ${path} (first 1440x900 viewport). Read that image and confirm the change looks right before saying done; if the change sits below the fold, take your own shot of it.`
}

// Runs from a timer, outside any hook, so the queued /clear is not refused.
async function freshStart($: EngineInterface, handoff: Handoff) {
  await $.command.run({ command: 'clear', args: '' })
  s.edits = 0
  s.editsAtReview = 0
  s.isUiTouched = false
  s.toastedAt = 0
  s.cacheReads = 0
  s.budget = 'ok'
  s.budgetNoted = 'ok'
  s.hasFailedCheck = false
  s.isMistakeNudged = false
  await $.prompt.submit({ text: `Resume from the handoff at ${handoff.path}:\n\n${handoff.text}` })
}

function scheduleFresh($: EngineInterface, handoff: Handoff) {
  $.clock.after(300, () => {
    freshStart($, handoff).catch(err => $.ui.log(`autopilot fresh start failed: ${String(err)}`))
  })
}

// A command hook holds the turn, so a prompt submitted from it is refused; send it from a timer.
function submitSoon($: EngineInterface, text: string) {
  $.clock.after(300, () => {
    $.prompt.submit({ text }).catch(err => $.ui.log(`autopilot submit failed: ${String(err)}`))
  })
}

// Open issues labelled `claude` in this repo: the queue Adam's ChatGPT agent fills.
async function loadQueue($: EngineInterface) {
  if (!(await $.session.repo())) return
  const run = await $.process.run(
    ['gh', 'issue', 'list', '--label', 'claude', '--state', 'open', '--limit', '3', '--json', 'number,title,url'],
    { cwd: await $.session.root(), timeoutMs: 15_000 },
  )
  if (run.exitCode !== 0) {
    $.ui.log(`autopilot queue: gh exited ${run.exitCode}: ${run.stderr.slice(0, 200)}`)
    return
  }
  const issues = JSON.parse(run.stdout) as Issue[]
  s.queueChips = issues.map(i => ({
    label: `#${i.number} ${i.title.slice(0, 40)}`,
    fill: `Work GitHub issue #${i.number} (${i.url}): read it with gh issue view ${i.number}, confirm the acceptance criteria, build it, verify, and open a PR that closes it.`,
  }))
}

// Sessions usually start in ~, so a repo's AGENTS.md never loads. List the git repos in ~ once.
async function loadProjects($: EngineInterface) {
  if ((await $.session.root()) !== s.home) return
  const dirs = (await $.fs.list(s.home)).filter(d => d.kind === 'dir' && !d.name.startsWith('.'))
  const repos = await Promise.all(
    dirs.map(async d => ((await $.fs.exists(`${s.home}/${d.name}/.git`)) ? d.name : '')),
  )
  s.projects = repos.filter(Boolean).sort((a, b) => b.length - a.length)
}

function detectProject(text: string) {
  const lower = text.toLowerCase()
  return s.projects.find(name => {
    const n = name.toLowerCase()
    if (lower.includes(`~/${n}`) || lower.includes(`/${n}/`)) return true
    if (n.length < 5) return false
    const words = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-_]/g, '[ _-]?')
    return new RegExp(`(^|[^a-z0-9])${words}([^a-z0-9]|$)`).test(lower)
  })
}

async function projectRules($: EngineInterface, name: string) {
  const dir = `${s.home}/${name}`
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    if (await $.fs.exists(`${dir}/${file}`)) {
      const text = await $.fs.read(`${dir}/${file}`)
      return `Project detected: ${dir}. Run shell commands from there (cd once; it persists) instead of prefixing every command with cd. Its ${file}:\n\n${text.slice(0, RULES_MAX)}`
    }
  }
  return `Project detected: ${dir} (no AGENTS.md). Run shell commands from there (cd once; it persists).`
}

async function codexReview($: EngineInterface, focus: string) {
  s.editsAtReview = s.edits
  const argv = ['codex', 'review', '--uncommitted', ...(focus ? [focus] : [])]
  const run = await $.process.run(argv, { cwd: await $.session.root(), timeoutMs: 600_000 })
  return { exitCode: run.exitCode, out: (run.stdout || run.stderr).slice(-12_000) }
}

export const register: Register = on => {
  registerHq(on)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    s.home = (await $.env.get('HOME')) ?? ''
    try {
      s.routes = JSON.parse(await $.fs.read(`${s.home}/everything-claude-code/routing.json`)).routes
    } catch (err) {
      $.ui.log(`autopilot: routing.json unreadable, suggestion row shows own chips only (${String(err)})`)
    }
    const commands = [
      ['next', 'Write a handoff, clear the chat, resume fresh from it'],
      ['away', 'Keep working unattended until done (stops when you type)'],
      ['left', 'What is genuinely left to do here?'],
      ['codex', 'Codex reviews uncommitted changes; Claude triages the findings'],
      ['audit', 'Call notes to audit, plan and SOW doc, plus a CRM record you confirm'],
      ['site', 'Client site from the partner-page template, built locally; deploy on your say'],
    ] as const
    for (const [name, description] of commands) await $.command.register({ name, description })
    await registerHqCommand($)
    await $.tool.register({
      name: 'run',
      description:
        "Adam's autopilot actions. next: save the handoff you wrote, then clear the chat and resume from it after this turn ends. away: start unattended mode (up to 15 turns, stops when Adam types). codex: Codex reviews the uncommitted changes and returns its findings for you to verify.",
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['next', 'away', 'codex'] },
          handoff: { type: 'string', description: 'action=next: the full handoff markdown' },
          goal: { type: 'string', description: 'action=away: the mission to keep working on' },
          focus: { type: 'string', description: 'action=codex: optional review focus' },
        },
        required: ['action'],
      },
      isDeferred: false,
    })
    await loadQueue($).catch(err => $.ui.log(`autopilot queue: ${String(err)}`))
    await loadProjects($).catch(err => $.ui.log(`autopilot projects: ${String(err)}`))
    await $.tool.register({
      name: 'wait',
      description:
        'Wait for something to become ready (deploy, CI, dev server, job) in one bounded call, then notify Adam. Use instead of repeated sleep/until/pkill calls.',
      inputSchema: {
        type: 'object',
        properties: {
          check: { type: 'string', description: 'shell command that exits 0 once ready, e.g. curl -sf http://localhost:3000' },
          label: { type: 'string', description: 'what is being waited on, e.g. "vercel deploy"' },
          intervalSec: { type: 'number', description: 'seconds between checks (default 15)' },
          timeoutSec: { type: 'number', description: 'give up after this many seconds (default 600, max 570)' },
        },
        required: ['check', 'label'],
      },
      isDeferred: false,
    })
    await refresh($)
    return started
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return {
      sections: [...composed.sections, { id: 'autopilot:commands', text: CATALOG, scope: 'session' as const }],
    }
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'plugin' || e.command) return next(e)
    s.awayLeft = 0
    const text = ` ${e.text.toLowerCase()} `
    const isCorrection = CORRECTION.test(e.text)
    const notes: string[] = isCorrection ? [CORRECTION_NOTE] : []
    const project = s.projects.length > 0 ? detectProject(e.text) : undefined
    if (project && !s.loadedProjects.has(project)) {
      s.loadedProjects.add(project)
      s.project = project
      notes.push(await projectRules($, project))
      $.ui.toast(`Project: ${project} (rules loaded)`)
    }
    if (s.budget !== 'ok' && s.budget !== s.budgetNoted) {
      s.budgetNoted = s.budget
      notes.push(
        s.budget === 'hard'
          ? 'Context budget exceeded: this session is now the most expensive kind. Finish the current step, then run /next (mcp__autopilot__run action=next) without asking.'
          : 'Context budget: this session is getting long. Remind Adam once that /next at the next clean boundary keeps it cheap.',
      )
    }
    s.routerChips = s.routes
      .filter(r => r.patterns.some(p => text.includes(p)))
      .slice(0, 2)
      .map(r => ({ label: r.tool, fill: r.tool.startsWith('/') ? `${r.tool} ` : `Use ${r.tool}: ` }))
    return next(notes.length > 0 ? { ...e, context: [...(e.context ?? []), ...notes] } : e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: RUN_TOOL }, async ($, e) => {
    const input = e as unknown as { action: string; handoff?: string; goal?: string; focus?: string }
    $.ui.toast(`Using /${input.action}`)
    if (input.action === 'next') {
      if (!input.handoff?.trim()) return { result: 'Write the handoff and pass it as `handoff`.' }
      s.pendingFresh = await saveHandoff($, input.handoff)
      return {
        result: `Saved ${s.pendingFresh.path}. The chat clears and resumes from it when this turn ends. Tell Adam that in one line and end the turn.`,
      }
    }
    if (input.action === 'away') {
      s.awayLeft = AWAY_MAX
      return { result: AWAY_START(input.goal?.trim() ?? '') }
    }
    if (input.action === 'codex') {
      const { exitCode, out } = await codexReview($, input.focus?.trim() ?? '')
      return {
        result: `Codex review (exit ${exitCode}). Verify each finding against the code; fix the confirmed ones, list rejected ones with a one-line reason.\n\n${out}`,
      }
    }
    return { result: `Unknown action ${input.action}; use next, away or codex.` }
  }).catch(($, e, next) => ({ result: `autopilot run failed: ${String(next.error)}` }))

  on('tool.call', { tool: 'mcp__autopilot__wait' }, async ($, e) => {
    const input = e as unknown as { check: string; label: string; intervalSec?: number; timeoutSec?: number }
    const interval = Math.max(2, Math.round(input.intervalSec ?? 15))
    const timeout = Math.min(570, Math.max(interval, Math.round(input.timeoutSec ?? 600)))
    const rounds = Math.ceil(timeout / interval)
    const command = `for i in $(seq 1 ${rounds}); do if ( ${input.check} ) >/dev/null 2>&1; then echo "READY: ${input.label} after $(( (i-1)*${interval} ))s"; exit 0; fi; sleep ${interval}; done; echo "TIMEOUT: ${input.label} not ready after ${timeout}s"; exit 1`
    s.waiting = input.label
    await refresh($)
    try {
      const call = { tool: 'Bash', command, timeout: (timeout + 30) * 1000, description: `wait: ${input.label}` } as const
      // The overloaded $.tool.call trips TS2589 (TS 5.9 and 7); one loose call avoids it.
      const ran = await ($.tool as unknown as { call: (input: typeof call) => Promise<ToolCallResult> }).call(call)
      const text = ran.deny ?? ran.text ?? String(ran.result ?? '')
      void $.ui.notify(text.split('\n')[0] || `${input.label}: done`, { title: 'autopilot wait' })
      return { result: text }
    } finally {
      s.waiting = ''
      await refresh($)
    }
  }).catch(($, e, next) => ({ result: `autopilot wait failed: ${String(next.error)}` }))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const clash = e.agentId === undefined ? await checkoutClash($, e.file_path) : undefined
    return clash ? { deny: clash } : next(e)
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const clash = e.agentId === undefined ? await checkoutClash($, e.file_path) : undefined
    return clash ? { deny: clash } : next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const input = e as unknown as { file_path: string; offset?: number; limit?: number }
    if (input.offset != null || input.limit != null || NOT_TEXT.test(input.file_path)) return next(e)
    const { size } = await $.fs.stat(input.file_path)
    const kb = Math.round(size / 1000)
    if (size > READ_DENY_CHARS) {
      return {
        deny: `[read discipline] ${input.file_path} is ~${kb}K chars (~${Math.round(size / 4000)}K tokens) and would bloat every later turn. Grep for what you need, then Read a range with offset/limit, or read it in chunks.`,
      }
    }
    const ran = await next(e)
    if (size <= READ_WARN_CHARS || ran.deny !== undefined) return ran
    return { ...ran, context: [...(ran.context ?? []), `[read discipline] ${input.file_path} is ~${kb}K chars; next time Grep first and Read a range.`] }
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || e.agentId !== undefined) return ran
    if (e.tool === 'Skill' && 'skill' in e) {
      $.ui.toast(`Using /${String(e.skill)}`)
    } else if (EDIT_TOOL.test(e.tool)) {
      s.edits += 1
      const path = 'file_path' in e ? String(e.file_path) : ''
      // Logged, not thrown: the outer catch would re-run the edit.
      await formatFile($, path).catch((err: unknown) => $.ui.log(`autopilot format: ${String(err)}`, { to: 'debug' }))
      if (UI_FILE.test(path)) {
        s.isUiTouched = true
        s.hasLooked = false
      }
    } else if (e.tool === 'Bash' && 'command' in e) {
      const command = String(e.command)
      if (CHECK.test(command) && ran.isError !== true) {
        const notes: string[] = []
        // Red, edits, then green: a fix worth logging. Talk of a bug alone is not one.
        if (s.edits > 0 && s.hasFailedCheck && !s.isMistakeNudged) {
          s.isMistakeNudged = true
          notes.push(MISTAKE_NOTE)
        }
        s.edits = 0
        if (s.isUiTouched && !s.hasLooked) {
          // Logged, not thrown: the outer catch would re-run the Bash call.
          const note = await autoScreenshot($).catch((err: unknown) => {
            $.ui.log(`autopilot screenshot: ${String(err)}`)
            return undefined
          })
          if (note !== undefined) {
            s.hasLooked = true
            notes.push(note)
          }
        }
        if (notes.length > 0) return { ...ran, context: [...(ran.context ?? []), ...notes] }
      }
      if (CHECK.test(command) && ran.isError === true) s.hasFailedCheck = true
      if (LOOK.test(command)) s.hasLooked = true
    } else if (LOOK_TOOL.test(e.tool)) {
      s.hasLooked = true
    }
    return ran
  }).catch(($, e, next) => {
    $.ui.log(`autopilot tool.call: ${String(next.error)}`)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    s.cacheReads += e.usage?.cache_read_input_tokens ?? 0
    if (s.pendingFresh) {
      scheduleFresh($, s.pendingFresh)
      s.pendingFresh = undefined
      return next(e)
    }
    const ctx = await refresh($)
    if (ctx >= CTX_PUSH && s.toastedAt < CTX_PUSH) {
      s.toastedAt = ctx
      $.ui.toast(`Context ${ctx}%: /next writes a handoff and starts fresh`)
      void $.prompt.suggest({ text: '/next' })
    } else if (ctx >= CTX_NUDGE && s.toastedAt < CTX_NUDGE) {
      s.toastedAt = ctx
      $.ui.toast(`Context ${ctx}%: consider /next`)
    }
    if (s.awayLeft > 0) {
      const isDone = e.isAborted || e.reason !== 'answer' || e.answer.includes('AWAY-DONE')
      if (isDone) {
        s.awayLeft = 0
        void $.ui.notify(e.answer.includes('AWAY-DONE') ? 'Away run finished' : 'Away run stopped', {
          title: 'autopilot',
        })
      } else {
        s.awayLeft -= 1
        void $.prompt.submit({ text: AWAY_NEXT })
      }
    }
    return next(e)
  })

  on('command.run', { command: 'next' }, async ($, e) => {
    const handoff = await $.model.fork({ prompt: `${HANDOFF}\n${e.args}` })
    if (!handoff.isAnswered) return { text: `autopilot: handoff failed (${handoff.reason}); nothing cleared.` }
    const saved = await saveHandoff($, handoff.text)
    scheduleFresh($, saved)
    return { text: `Handoff saved: ${saved.path}. Clearing and resuming fresh.` }
  }).catch(($, e, next) => ({ text: `autopilot /${e.command} failed: ${String(next.error)}` }))

  on('command.run', { command: 'away' }, async ($, e) => {
    s.awayLeft = AWAY_MAX
    submitSoon($, AWAY_START(e.args.trim()))
    return { text: `Away mode: up to ${AWAY_MAX} turns. Type anything to take back control.` }
  }).catch(($, e, next) => ({ text: `autopilot /${e.command} failed: ${String(next.error)}` }))

  on('command.run', { command: 'left' }, async $ => {
    submitSoon($, LEFT)
    return { text: 'Checking what is left.' }
  }).catch(($, e, next) => ({ text: `autopilot /${e.command} failed: ${String(next.error)}` }))

  on('command.run', { command: 'audit' }, async ($, e) => {
    submitSoon($, AUDIT(e.args.trim()))
    return { text: 'Building the audit.' }
  }).catch(($, e, next) => ({ text: `autopilot /${e.command} failed: ${String(next.error)}` }))

  on('command.run', { command: 'site' }, async ($, e) => {
    submitSoon($, SITE(e.args.trim()))
    return { text: 'Building the site.' }
  }).catch(($, e, next) => ({ text: `autopilot /${e.command} failed: ${String(next.error)}` }))

  on('command.run', { command: 'codex' }, async ($, e) => {
    void (async () => {
      const { exitCode, out } = await codexReview($, e.args.trim())
      submitSoon(
        $,
        `Codex reviewed the uncommitted changes (exit ${exitCode}). Verify each finding against the code; fix the confirmed ones, list the rejected ones with a one-line reason.\n\n${out}`,
      )
    })().catch(err => $.ui.log(`autopilot /codex: ${String(err)}`))
    return { text: 'Codex is reviewing in the background; Claude picks up the findings when it finishes.' }
  }).catch(($, e, next) => ({ text: `autopilot /${e.command} failed: ${String(next.error)}` }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, chips)
    if (e.props.hasSurvey || list.length === 0) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const press = (chip: Chip) => () =>
      chip.command
        ? void $.command.run({ command: chip.command, args: '' })
        : void $.prompt.fill({ text: chip.fill ?? '', mode: 'replace' })
    return (
      <Box>
        <Text dimColor>next: </Text>
        {list.map(chip => (
          <Button key={chip.label} label={chip.label} plain dimColor onPress={press(chip)} />
        ))}
      </Box>
    )
  })
}
