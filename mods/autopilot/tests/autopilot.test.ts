import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const ROUTES = JSON.stringify({ routes: [{ id: 'ship', patterns: ['ship it'], tool: '/cap' }] })

function bottom(on: On, log: { registered: string[]; tools: string[]; writes: string[]; contexts: string[][]; root?: string; onText?: (text: string) => void; runs?: string[][]; files?: Map<string, string>; session?: string; dirs?: Record<string, { name: string; kind: string; isLink?: boolean }[]>; noBrowser?: boolean }) {
  on('env.get', () => ({ value: '/home/adam' }))
  on('fs.read', (_$, e) => ({ value: log.files?.get(e.path) ?? (e.path.endsWith('AGENTS.md') ? 'Rule: VP leads go to Close.' : ROUTES) }))
  on('fs.write', (_$, e) => {
    log.writes.push(e.path)
    log.files?.set(e.path, e.text)
    return { value: undefined }
  })
  on('process.run', (_$, e) => {
    log.runs?.push([...e.argv])
    if (log.noBrowser && e.argv.includes('playwright'))
      return { value: { exitCode: 1, stdout: '', stderr: "Error: Executable doesn't exist at /x/ms-playwright/chromium_headless_shell-1243", isStdoutTruncated: false, isStderrTruncated: false } }
    const [cmd, sub] = e.argv
    const stdout =
      cmd === 'git' && e.argv.includes('--show-toplevel')
        ? '/home/adam/repo\n'
        : cmd === 'vercel'
        ? JSON.stringify({ deployments: [
            { name: 'vending-website', readyState: 'ERROR', target: 'production', created: 1_000, url: 'vw.vercel.app' },
            { name: 'vending-website', readyState: 'READY', target: 'production', created: 500, url: 'old.vercel.app' },
          ] })
        : cmd === 'gh' && sub === 'api'
          ? JSON.stringify({ data: { search: { nodes: [
              { title: 'Funnel tags', number: 170, url: 'u', isDraft: false, repository: { nameWithOwner: 'AIMS-Product/vending-website' },
                commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] } },
            ] } } })
          : cmd === 'gh' && sub === 'search'
            ? JSON.stringify([{ number: 4, title: 'Rewrite worst campaign', url: 'u', repository: { nameWithOwner: 'adamwolfe2/campaign-os' } }])
            : cmd === 'gh'
              ? JSON.stringify([{ number: 12, title: 'Fix signup redirect', url: 'https://github.com/x/y/issues/12' }])
              : 'P1: null check missing in a.ts'
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.repo', () => ({ value: { owner: 'x', name: 'y' } as never }))
  on('command.register', (_$, e) => {
    log.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('tool.register', (_$, e) => {
    log.tools.push(e.name)
    return { value: { tool: `mcp__autopilot__${e.name}` } }
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 20 }, rateLimits: [] } }))
  on('session.id', () => ({ value: log.session ?? 'me-session' }))
  on('session.root', () => ({ value: log.root ?? '/home/adam/repo' }))
  on('fs.list', (_$, e) => ({ value: (log.dirs?.[e.path] as never) ?? [
    { name: 'vending-website', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
    { name: 'sendmore', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
    { name: 'Downloads', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
  ] }))
  on('fs.exists', (_$, e) => ({ value: log.files?.has(e.path) || e.path in (log.dirs ?? {}) || /vending-website\/(\.git|AGENTS\.md)$|sendmore\/\.git$/.test(e.path) }))
  on('fs.stat', (_$, e) => ({ value: { kind: 'file', size: e.path.endsWith('big.ts') ? 90_000 : e.path.endsWith('mid.ts') ? 30_000 : 500, mtimeMs: 0, isLink: false } }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'terminal_bell' } }))
  on('ui.open', () => ({ value: { isPlaced: true } as never }))
  on('clock.every', () => ({ value: { id: 1 } as never }))
  on('clock.now', () => ({ value: 0 }))
  on('session.start', () => ({ cwd: '/home/adam/repo' }))
  on('prompt.submit', (_$, e) => {
    log.contexts.push([...(e.context ?? [])])
    log.onText?.(e.text)
    return { text: e.text }
  })
  on('prompt.compose', () => ({ sections: [{ id: 'core', text: 'core', scope: 'shared' }] }))
  // A Bash command carrying `#fail` fails, as a red check does live.
  on('tool.call', (_$, e) => ({ result: 'ok', ...('command' in e && String(e.command).includes('#fail') ? { isError: true } : {}) }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', () => null as never)
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
}

test('registers commands and the run tool; suggests /cap and /verify; a passing check clears /verify', async ($, on) => {
  const log = { registered: [] as string[], tools: [] as string[], writes: [] as string[], contexts: [] as string[][] }
  bottom(on, log)
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  expect(log.registered).toEqual(['next', 'away', 'left', 'codex', 'audit', 'site', 'lib', 'hq'])
  expect(log.tools).toEqual(['run', 'wait'])

  await $.prompt.submit({ text: 'looks good, ship it', wait: false, origin: { kind: 'composer' } } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/home/adam/repo/a.ts', old_string: 'a', new_string: 'b' } as never)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'autopilot', surface, component: 'AbovePrompt', props: {} } as never)
    expect(await ui.find({ key: '/verify 1 edits' } as never)).toBeDefined()
    expect(await ui.find({ key: '/cap' } as never)).toBeDefined()
    await ui.unmount()
  }

  await $.tool.call({ tool: 'Bash', command: 'pnpm test' } as never)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer' } as never)
  const ui = await $.ui.mount({ plugin: 'autopilot', surface: 'terminal', component: 'AbovePrompt', props: {} } as never)
  expect(await ui.find({ key: '/verify 1 edits' } as never)).toBeUndefined()
})

test('the system prompt gains the command catalog', async ($, on) => {
  bottom(on, { registered: [], tools: [], writes: [], contexts: [] })
  const { sections } = await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as never)
  const catalog = sections.find(x => x.id === 'autopilot:commands')
  expect(catalog?.text).toContain('Using /<name>')
  expect(sections.at(-1)?.id).toBe('autopilot:commands')
})

test('the run tool saves a handoff, starts away mode, and returns codex findings', async ($, on) => {
  const log = { registered: [] as string[], tools: [] as string[], writes: [] as string[], contexts: [] as string[][] }
  bottom(on, log)
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)

  const next = await $.tool.call({ tool: 'mcp__autopilot__run', action: 'next', handoff: '## Mission\nship it' } as never)
  expect(String(next.result)).toContain('/home/adam/repo/.claude/handoffs/')
  expect(log.writes[0]).toContain('/home/adam/repo/.claude/handoffs/')

  const away = await $.tool.call({ tool: 'mcp__autopilot__run', action: 'away', goal: 'finish auth' } as never)
  expect(String(away.result)).toContain('finish auth')

  const codex = await $.tool.call({ tool: 'mcp__autopilot__run', action: 'codex' } as never)
  expect(String(codex.result)).toContain('null check missing')
})

test('queued claude issues become buttons, and a correction adds the re-read note', async ($, on) => {
  const log = { registered: [] as string[], tools: [] as string[], writes: [] as string[], contexts: [] as string[][] }
  bottom(on, log)
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.turn.complete({ answer: 'hi', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  const ui = await $.ui.mount({ plugin: 'autopilot', surface: 'terminal', component: 'AbovePrompt', props: {} } as never)
  expect(await ui.find({ key: '#12 Fix signup redirect' } as never)).toBeDefined()

  await $.prompt.submit({ text: "that's not what I asked for", wait: false, origin: { kind: 'composer' } } as never)
  expect(log.contexts.at(-1)?.join(' ')).toContain('Adam is correcting you')
  await $.prompt.submit({ text: 'add a footer', wait: false, origin: { kind: 'composer' } } as never)
  expect(log.contexts.at(-1)).toEqual([])
})

test('in the home folder, naming a project loads its AGENTS.md once', async ($, on) => {
  const log = { registered: [] as string[], tools: [] as string[], writes: [] as string[], contexts: [] as string[][], root: '/home/adam' }
  bottom(on, log)
  await $.session.start({ cwd: '/home/adam', source: 'startup' } as never)
  await $.prompt.submit({ text: 'fix the hero on vending website', wait: false, origin: { kind: 'composer' } } as never)
  expect(log.contexts.at(-1)?.join(' ')).toContain('Rule: VP leads go to Close.')
  await $.prompt.submit({ text: 'and the vending-website footer', wait: false, origin: { kind: 'composer' } } as never)
  expect(log.contexts.at(-1)).toEqual([])
  await $.prompt.submit({ text: 'check downloads', wait: false, origin: { kind: 'composer' } } as never)
  expect(log.contexts.at(-1)).toEqual([])
})

test('whole reads of big files are denied, mid files pass with a nudge, ranges pass', async ($, on) => {
  bottom(on, { registered: [], tools: [], writes: [], contexts: [] })
  const big = await $.tool.call({ tool: 'Read', file_path: '/r/big.ts' } as never)
  expect(String(big.text ?? big.deny)).toContain('read discipline')
  const ranged = await $.tool.call({ tool: 'Read', file_path: '/r/big.ts', offset: 1, limit: 50 } as never)
  expect(ranged.isError).toBeUndefined()
  const mid = await $.tool.call({ tool: 'Read', file_path: '/r/mid.ts' } as never)
  expect(mid.context?.join(' ')).toContain('read discipline')
})

test('wait runs one bounded check through Bash and reports', async ($, on) => {
  const commands: string[] = []
  on('tool.call', { tool: 'Bash' }, (_$, e) => {
    commands.push(String((e as unknown as { command: string }).command))
    return { result: 'READY: deploy after 30s' }
  })
  bottom(on, { registered: [], tools: [], writes: [], contexts: [] })
  const out = await $.tool.call({ tool: 'mcp__autopilot__wait', check: 'curl -sf https://x.dev', label: 'deploy', intervalSec: 10, timeoutSec: 60 } as never)
  expect(commands).toHaveLength(1)
  expect(commands[0]).toContain('seq 1 6')
  expect(String(out.result)).toContain('READY')
})

test('/hq shows the failed deploy, the red PR and the queue, newest deploy per project', async ($, on) => {
  bottom(on, { registered: [], tools: [], writes: [], contexts: [] })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  const ran = await $.command.run({ command: 'hq', args: '' } as never)
  expect(ran.text).toContain('HQ pane open')
  const ui = await $.ui.mount({ plugin: 'autopilot', surface: 'terminal', component: 'Pane', requestId: 'hq', props: {} } as never)
  expect(await ui.find({ type: 'Text', text: /Loading/ } as never)).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /source\(s\) failed/ } as never)).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^ERROR/ } as never)).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^READY/ } as never)).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^FAILURE/ } as never)).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Rewrite worst campaign/ } as never)).toBeDefined()
})

test('a passing check after a UI edit screenshots the running dev server once', async ($, on) => {
  on('http.fetch', (_$, e) => {
    if (e.url.endsWith(':3000')) throw new Error('ECONNREFUSED')
    return { value: { status: 200, ok: true, headers: {}, text: '' } as never }
  })
  const argvs: string[][] = []
  bottom(on, { registered: [], tools: [], writes: [], contexts: [], runs: argvs })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/home/adam/repo/page.tsx', old_string: 'a', new_string: 'b' } as never)
  const first = await $.tool.call({ tool: 'Bash', command: 'pnpm test' } as never)
  expect(first.context?.join(' ')).toContain('http://localhost:5173 captured at')
  // A full-page shot of a long page reads back too small to see.
  const shot = argvs.find(a => a.includes('playwright')) ?? []
  expect(shot).toContain('--viewport-size=1440,900')
  expect(shot).not.toContain('--full-page')
  const second = await $.tool.call({ tool: 'Bash', command: 'pnpm test' } as never)
  expect(second.context?.join(' ') ?? '').not.toContain('[screenshot]')
})

test('a check that fails, then passes after edits, nudges /log-mistake alongside the screenshot', async ($, on) => {
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } as never }))
  bottom(on, { registered: [], tools: [], writes: [], contexts: [] })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.tool.call({ tool: 'Bash', command: 'pnpm test #fail' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/home/adam/repo/page.tsx', old_string: 'a', new_string: 'b' } as never)
  const ran = await $.tool.call({ tool: 'Bash', command: 'pnpm test' } as never)
  const context = ran.context?.join(' ') ?? ''
  expect(context).toContain('[mistake-log]')
  expect(context).toContain('[screenshot]')
})

test('talking about a bug without a failed check does not nudge /log-mistake', async ($, on) => {
  bottom(on, { registered: [], tools: [], writes: [], contexts: [] })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.prompt.submit({ text: 'fix any bug the live tests reveal', wait: false, origin: { kind: 'composer' } } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/home/adam/repo/a.ts', old_string: 'a', new_string: 'b' } as never)
  const ran = await $.tool.call({ tool: 'Bash', command: 'pnpm test' } as never)
  expect(ran.context?.join(' ') ?? '').not.toContain('[mistake-log]')
})

test('/audit submits the audit flow for the named client, CRM write left to Adam', async ($, on) => {
  const log: Parameters<typeof bottom>[1] = { registered: [], tools: [], writes: [], contexts: [] }
  // The timer fires only once the command hook has returned, as it does live.
  let release = () => {}
  const returned = new Promise<void>(resolve => { release = resolve })
  on('clock.after', async () => {
    await returned
    return { value: undefined as never }
  })
  bottom(on, log)
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  const got = new Promise<string>(resolve => {
    log.onText = text => { if (text.includes('client audit flow')) resolve(text) }
  })
  const ran = await $.command.run({ command: 'audit', args: 'Acme Dental' } as never)
  release()
  expect(ran.text).toContain('Building the audit')
  const prompt = await got
  expect(prompt).toContain('Acme Dental')
  expect(prompt).toContain('npm run client:upsert')
  expect(prompt).toContain('git pull --ff-only')
  expect(prompt).toContain('Only after Adam says confirm')
})

test('/site builds from clean template main and holds the repo and deploy for Adam', async ($, on) => {
  const log: Parameters<typeof bottom>[1] = { registered: [], tools: [], writes: [], contexts: [] }
  // The timer fires only once the command hook has returned, as it does live.
  let release = () => {}
  const returned = new Promise<void>(resolve => { release = resolve })
  on('clock.after', async () => {
    await returned
    return { value: undefined as never }
  })
  bottom(on, log)
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  const got = new Promise<string>(resolve => {
    log.onText = text => { if (text.includes('client site for')) resolve(text) }
  })
  await $.command.run({ command: 'site', args: 'Acme Dental' } as never)
  release()
  const prompt = await got
  expect(prompt).toContain('Acme Dental')
  expect(prompt).toContain('archive origin/main')
  expect(prompt).toContain('--viewport-size=<w>,900')
  expect(prompt).toContain('Only after Adam says ship')
})

test('an edit in a checkout another live session is editing is held once with a worktree hint', async ($, on) => {
  const lock = '/home/adam/.claude/state/autopilot-locks/_home_adam_repo.json'
  const files = new Map([[lock, JSON.stringify({ session: 'other-session', at: 0 })]])
  bottom(on, { registered: [], tools: [], writes: [], contexts: [], files })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  const edit = { tool: 'Edit', file_path: '/home/adam/repo/a.ts', old_string: 'a', new_string: 'b' } as never
  const first = await $.tool.call(edit)
  expect(first.deny ?? '').toContain('EnterWorktree')
  expect(JSON.parse(files.get(lock) ?? '{}').session).toBe('me-session')
  const second = await $.tool.call(edit)
  expect(second.deny).toBeUndefined()
})

test('an edit with no other live session on the checkout goes straight through', async ($, on) => {
  const files = new Map<string, string>()
  bottom(on, { registered: [], tools: [], writes: [], contexts: [], files })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  const ran = await $.tool.call({ tool: 'Edit', file_path: '/home/adam/repo/a.ts', old_string: 'a', new_string: 'b' } as never)
  expect(ran.deny).toBeUndefined()
  expect([...files.keys()].some(k => k.endsWith('_home_adam_repo.json'))).toBe(true)
})

test("an edited file is formatted with the repo's own prettier, and only where the repo has one", async ($, on) => {
  const runs: string[][] = []
  const files = new Map([['/home/adam/repo/.prettierrc', '{}'], ['/home/adam/repo/node_modules/.bin/prettier', '']])
  bottom(on, { registered: [], tools: [], writes: [], contexts: [], files, runs })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/home/adam/repo/a.ts', old_string: 'a', new_string: 'b' } as never)
  expect(runs).toContainEqual(['/home/adam/repo/node_modules/.bin/prettier', '--write', '/home/adam/repo/a.ts'])
  files.delete('/home/adam/repo/.prettierrc')
  runs.length = 0
  await $.tool.call({ tool: 'Edit', file_path: '/home/adam/repo/b.ts', old_string: 'a', new_string: 'b' } as never)
  expect(runs.some(a => a[0]?.endsWith('prettier'))).toBe(false)
})

test('each typed prompt is logged to telemetry, marked when it corrects Claude', async ($, on) => {
  const runs: string[][] = []
  bottom(on, { registered: [], tools: [], writes: [], contexts: [], runs })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.prompt.submit({ text: 'add a footer', wait: false, origin: { kind: 'composer' } } as never)
  await $.prompt.submit({ text: "that's not what I asked for", wait: false, origin: { kind: 'composer' } } as never)
  // A headless run (smoke test, cron) is not Adam typing.
  await $.prompt.submit({ text: 'run the check', wait: false, origin: { kind: 'sdk' } } as never)
  const logged = runs.filter(a => a.includes('/home/adam/.claude/telemetry.jsonl')).map(a => JSON.parse(a[4] ?? '{}'))
  expect(logged.map(l => [l.type, l.isCorrection])).toEqual([['autopilot.prompt', false], ['autopilot.prompt', true]])
})

const LIB = '/home/adam/everything-claude-code/archive'
function library() {
  const files = new Map([
    [`${LIB}/skills/pricing/SKILL.md`, '---\nname: pricing\ndescription: Pricing strategy for subscription plans, tiers and packaging\n---\nPRICING BODY'],
    [`${LIB}/skills/clerk/SKILL.md`, '---\ndescription: Clerk auth setup and middleware\n---\nCLERK BODY'],
    [`${LIB}/commands/mode-review.md`, '---\ndescription: Code review context\n---\nREVIEW BODY'],
  ])
  const dirs = {
    [`${LIB}/skills`]: [{ name: 'pricing', kind: 'dir' }, { name: 'clerk', kind: 'dir' }],
    [`${LIB}/commands`]: [{ name: 'mode-review.md', kind: 'other', isLink: true }],
  }
  return { files, dirs }
}
const telemetry = (runs: string[][]) => runs.filter(a => a.includes('/home/adam/.claude/telemetry.jsonl')).map(a => JSON.parse(a[4] ?? '{}'))

test('the run tool loads an archived skill by query and logs the library load', async ($, on) => {
  const runs: string[][] = []
  bottom(on, { registered: [], tools: [], writes: [], contexts: [], runs, ...library() })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  const out = await $.tool.call({ tool: 'mcp__autopilot__run', action: 'skill', query: 'pricing tiers' } as never)
  expect(String(out.result)).toContain('PRICING BODY')
  expect(telemetry(runs)).toContainEqual(expect.objectContaining({ type: 'autopilot.skill', name: 'pricing', source: 'library' }))
  const none = await $.tool.call({ tool: 'mcp__autopilot__run', action: 'skill', query: 'kubernetes' } as never)
  expect(String(none.result)).toContain('No archived skill')
})

test('a prompt that fits an archived skill gets a one-time library hint', async ($, on) => {
  const lib = library()
  const log = { registered: [], tools: [], writes: [], contexts: [] as string[][], ...lib }
  bottom(on, log)
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.prompt.submit({ text: 'set pricing tiers for the subscription plans', wait: false, origin: { kind: 'composer' } } as never)
  expect(log.contexts.flat().join(' ')).toContain('[library] Archived skill "pricing"')
  await $.prompt.submit({ text: 'and the pricing tiers for subscription plans again', wait: false, origin: { kind: 'composer' } } as never)
  expect(log.contexts.flat().join(' ').split('[library]').length).toBe(2)
  await $.prompt.submit({ text: 'fix the footer', wait: false, origin: { kind: 'composer' } } as never)
  expect(log.contexts.at(-1)?.join(' ') ?? '').not.toContain('[library]')
})

test('skill and typed slash command use is logged to telemetry', async ($, on) => {
  const runs: string[][] = []
  bottom(on, { registered: [], tools: [], writes: [], contexts: [], runs })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.tool.call({ tool: 'Skill', skill: 'everything-claude-code:impeccable' } as never)
  await $.command.run({ command: 'left', args: '', origin: { kind: 'composer' } } as never)
  const names = telemetry(runs).filter(t => t.type === 'autopilot.skill').map(t => [t.name, t.source])
  expect(names).toEqual([['impeccable', 'tool'], ['left', 'command']])
})

test('/lib lists the library, and with a query asks Claude to load the match', async ($, on) => {
  const log: Parameters<typeof bottom>[1] = { registered: [], tools: [], writes: [], contexts: [], ...library() }
  bottom(on, log)
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  const listed = await $.command.run({ command: 'lib', args: '' } as never)
  expect(listed.text).toContain('pricing')
  expect(listed.text).toContain('mode-review')
})

test('a screenshot that fails for a missing browser tells Claude how to fix it', async ($, on) => {
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } as never }))
  bottom(on, { registered: [], tools: [], writes: [], contexts: [], noBrowser: true })
  await $.session.start({ cwd: '/home/adam/repo', source: 'startup' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/home/adam/repo/page.tsx', old_string: 'a', new_string: 'b' } as never)
  const ran = await $.tool.call({ tool: 'Bash', command: 'pnpm test' } as never)
  expect(ran.context?.join(' ') ?? '').toContain('npx playwright install chromium')
  const again = await $.tool.call({ tool: 'Bash', command: 'pnpm test' } as never)
  expect(again.context?.join(' ') ?? '').toContain('[screenshot]')
})
