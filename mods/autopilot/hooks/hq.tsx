import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Hq, HqDeploy, HqItem } from '../types'

const PANE = 'hq'
const REFRESH_MS = 5 * 60_000
const TEAMS = ['am-collective', 'aimanagingservices', 'modernamenities']
const OWNERS = ['adamwolfe2', 'AIMS-Product', 'ModernAmenities-Org']
const DAY_MS = 24 * 60 * 60_000
const PR_QUERY =
  '{search(query:"is:pr is:open author:@me archived:false", type:ISSUE, first:20){nodes{... on PullRequest{title number url isDraft repository{nameWithOwner} commits(last:1){nodes{commit{statusCheckRollup{state}}}}}}}}'

const hq = atom({ plugin: 'autopilot', key: 'hq' } as const, null)

type RawDeploy = { name: string; state?: string; readyState?: string; target?: string | null; created: number; url: string }
type RawPr = {
  title: string
  number: number
  url: string
  isDraft: boolean
  repository: { nameWithOwner: string }
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
}
type RawIssue = { number: number; title: string; url: string; repository: { nameWithOwner: string } }

const timer = { isRunning: false }

async function json<T>($: EngineInterface, argv: string[]): Promise<T> {
  const run = await $.process.run(argv, { timeoutMs: 30_000 })
  if (run.exitCode !== 0) throw new Error(`${argv.slice(0, 2).join(' ')} exited ${run.exitCode}: ${run.stderr.slice(0, 160)}`)
  return JSON.parse(run.stdout) as T
}

// Latest deploy per project; only the ones worth a look: failing, building, or shipped in the last day.
async function deploys($: EngineInterface, now: number): Promise<HqDeploy[]> {
  const perTeam = await Promise.all(
    TEAMS.map(async team => {
      const { deployments } = await json<{ deployments: RawDeploy[] }>($, [
        'vercel', 'api', '/v6/deployments?limit=40', '--scope', team,
      ])
      return deployments.map(d => ({ ...d, team }))
    }),
  )
  const latest = new Map<string, HqDeploy>()
  for (const d of perTeam.flat().sort((a, b) => b.created - a.created)) {
    if (latest.has(d.name)) continue
    latest.set(d.name, {
      project: d.name,
      team: d.team,
      state: d.readyState ?? d.state ?? 'UNKNOWN',
      isProd: d.target === 'production',
      createdAt: d.created,
      url: `https://${d.url}`,
    })
  }
  return [...latest.values()].filter(d => d.state !== 'READY' || now - d.createdAt < DAY_MS)
}

async function prs($: EngineInterface): Promise<HqItem[]> {
  const out = await json<{ data: { search: { nodes: RawPr[] } } }>($, ['gh', 'api', 'graphql', '-f', `query=${PR_QUERY}`])
  return out.data.search.nodes.map(p => ({
    repo: p.repository.nameWithOwner.split('/')[1] ?? p.repository.nameWithOwner,
    number: p.number,
    title: p.title,
    url: p.url,
    state: p.isDraft ? 'DRAFT' : (p.commits.nodes[0]?.commit.statusCheckRollup?.state ?? 'NONE'),
  }))
}

async function queue($: EngineInterface): Promise<HqItem[]> {
  const owners = OWNERS.flatMap(o => ['--owner', o])
  const issues = await json<RawIssue[]>($, [
    'gh', 'search', 'issues', '--label', 'claude', '--state', 'open', ...owners,
    '--json', 'number,title,url,repository', '--limit', '15',
  ])
  return issues.map(i => ({
    repo: i.repository.nameWithOwner.split('/')[1] ?? i.repository.nameWithOwner,
    number: i.number,
    title: i.title,
    url: i.url,
    state: 'QUEUED',
  }))
}

export async function loadHq($: EngineInterface) {
  const now = await $.clock.now()
  const [d, p, q] = await Promise.allSettled([deploys($, now), prs($), queue($)])
  const errors = [d, p, q].flatMap(r => (r.status === 'rejected' ? [String(r.reason)] : []))
  for (const err of errors) $.ui.log(`autopilot hq: ${err}`)
  const next: Hq = {
    deploys: d.status === 'fulfilled' ? d.value : [],
    prs: p.status === 'fulfilled' ? p.value : [],
    queue: q.status === 'fulfilled' ? q.value : [],
    updatedAt: now,
    errors,
  }
  await update($, hq, () => next)
  const failing = next.deploys.filter(x => x.state === 'ERROR').length
  const red = next.prs.filter(x => x.state === 'FAILURE' || x.state === 'ERROR').length
  if (failing + red > 0) $.ui.toast(`HQ: ${failing} failed deploy${failing === 1 ? '' : 's'}, ${red} red PR${red === 1 ? '' : 's'}`)
}

function tone(state: string) {
  if (state === 'ERROR' || state === 'FAILURE' || state === 'CANCELED') return 'error'
  if (state === 'BUILDING' || state === 'QUEUED' || state === 'PENDING' || state === 'INITIALIZING') return 'warning'
  if (state === 'READY' || state === 'SUCCESS') return 'success'
  return 'subtle'
}

function rank(state: string) {
  return tone(state) === 'error' ? 0 : tone(state) === 'warning' ? 1 : 2
}

export async function registerHqCommand($: EngineInterface) {
  await $.command.register({ name: 'hq', description: 'Open the cross-project pane: deploys, PRs + CI, claude queue' })
}

export function registerHq(on: On) {
  on('command.run', { command: 'hq' }, async $ => {
    await $.ui.open({ id: PANE, title: 'HQ' })
    if (!timer.isRunning) {
      timer.isRunning = true
      $.clock.every(REFRESH_MS, () => {
        loadHq($).catch(err => $.ui.log(`autopilot hq refresh: ${String(err)}`))
      })
    }
    await loadHq($)
    return { text: 'HQ pane open; refreshes every 5 minutes. /hq again refreshes now.' }
  }).catch(($, e, next) => ({ text: `autopilot /hq failed: ${String(next.error)}` }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const data = await read($, hq)
    if (!data) return <Text dimColor>Loading deploys, PRs and the claude queue...</Text>
    const room = Math.max(6, (e.viewport?.rows ?? 30) - 8)
    const deploysSorted = [...data.deploys].sort((a, b) => rank(a.state) - rank(b.state) || b.createdAt - a.createdAt)
    const prsSorted = [...data.prs].sort((a, b) => rank(a.state) - rank(b.state))
    const ago = (ms: number) => `${Math.max(1, Math.round((data.updatedAt - ms) / 3_600_000))}h`
    return (
      <Box flexDirection="column">
        <Text bold>Deploys (last 24h + anything not ready)</Text>
        {deploysSorted.length === 0 && <Text dimColor>Nothing new.</Text>}
        {deploysSorted.slice(0, Math.ceil(room / 2)).map(d => (
          <Text key={`d-${d.project}`} wrap="truncate-end">
            <Text color={tone(d.state)}>{d.state.padEnd(9)}</Text> {d.project} <Text dimColor>{d.isProd ? 'prod' : 'preview'} · {d.team} · {ago(d.createdAt)}</Text>
          </Text>
        ))}
        <Text bold>Open PRs</Text>
        {prsSorted.length === 0 && <Text dimColor>None open.</Text>}
        {prsSorted.slice(0, Math.ceil(room / 3)).map(p => (
          <Text key={`p-${p.repo}-${p.number}`} wrap="truncate-end">
            <Text color={tone(p.state)}>{p.state.padEnd(9)}</Text> {p.repo}#{p.number} <Text dimColor>{p.title}</Text>
          </Text>
        ))}
        <Text bold>Claude queue ({data.queue.length})</Text>
        {data.queue.length === 0 && <Text dimColor>Empty. ChatGPT files issues labelled claude here.</Text>}
        {data.queue.slice(0, 5).map(q => (
          <Text key={`q-${q.repo}-${q.number}`} wrap="truncate-end">
            {q.repo}#{q.number} <Text dimColor>{q.title}</Text>
          </Text>
        ))}
        {data.errors.length > 0 && <Text color="error">{data.errors.length} source(s) failed; see the transcript log.</Text>}
      </Box>
    )
  })
}
