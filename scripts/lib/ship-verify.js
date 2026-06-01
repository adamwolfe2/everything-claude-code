// Ship verification — confirms /cap actually shipped.
// Polls GitHub Actions + Vercel + curls the deployment URL.
// Returns a structured report. Never throws.

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function safe(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim()
  } catch (e) {
    return null
  }
}

function gitInfo() {
  const sha = safe('git rev-parse HEAD')
  const branch = safe('git rev-parse --abbrev-ref HEAD')
  const remote = safe('git remote get-url origin')
  let repo = null
  if (remote) {
    const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
    if (m) repo = `${m[1]}/${m[2]}`
  }
  return { sha, branch, remote, repo }
}

function isVercelProject() {
  return fs.existsSync(path.join(process.cwd(), '.vercel', 'project.json'))
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function pollGitHubActions({ repo, sha, maxAttempts = 30, intervalMs = 10000 }) {
  if (!repo || !sha) return { status: 'unknown', reason: 'no repo or sha' }
  if (!safe('which gh')) return { status: 'unknown', reason: 'gh CLI not installed' }
  for (let i = 0; i < maxAttempts; i++) {
    const out = safe(`gh run list --repo ${repo} --commit ${sha} --limit 5 --json status,conclusion,name,url`)
    if (out) {
      try {
        const runs = JSON.parse(out)
        if (runs.length === 0) {
          await sleep(intervalMs)
          continue
        }
        const allFinished = runs.every(r => r.status === 'completed')
        if (allFinished) {
          const allGreen = runs.every(r => r.conclusion === 'success' || r.conclusion === 'skipped')
          return {
            status: allGreen ? 'green' : 'red',
            runs: runs.map(r => ({ name: r.name, conclusion: r.conclusion, url: r.url })),
          }
        }
      } catch {}
    }
    await sleep(intervalMs)
  }
  return { status: 'timeout', reason: `polled ${maxAttempts} times` }
}

async function pollVercel({ maxAttempts = 60, intervalMs = 5000 }) {
  if (!isVercelProject()) return { status: 'n/a' }
  if (!safe('which vercel')) return { status: 'unknown', reason: 'vercel CLI not installed' }
  for (let i = 0; i < maxAttempts; i++) {
    const out = safe('vercel ls --json 2>/dev/null | head -50')
    if (out) {
      try {
        const list = JSON.parse(out)
        const latest = list.deployments?.[0] || list[0]
        if (latest) {
          const state = (latest.state || latest.readyState || '').toUpperCase()
          const url = latest.url ? `https://${latest.url}` : latest.alias?.[0]
          if (state === 'READY') return { status: 'ready', url, id: latest.uid }
          if (state === 'ERROR' || state === 'CANCELED') return { status: 'failed', state, url, id: latest.uid }
        }
      } catch {}
    }
    await sleep(intervalMs)
  }
  return { status: 'timeout', reason: `polled ${maxAttempts} times` }
}

async function curlUrl(url, { maxAttempts = 12, intervalMs = 5000 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = safe(`curl -s -o /dev/null -w "%{http_code}" -L --max-time 10 "${url}"`)
    if (code && /^[23]\d\d$/.test(code)) return { status: 'ok', httpCode: parseInt(code, 10) }
    if (code && /^[45]\d\d$/.test(code)) {
      await sleep(intervalMs)
      continue
    }
    await sleep(intervalMs)
  }
  return { status: 'unreachable', reason: `polled ${maxAttempts} times` }
}

async function verifyShip(opts = {}) {
  const git = gitInfo()
  const report = {
    ts: new Date().toISOString(),
    git,
    ci: { status: 'pending' },
    vercel: { status: 'pending' },
    url: { status: 'pending' },
    overall: 'pending',
  }

  // Stage 1: CI
  report.ci = await pollGitHubActions({ repo: git.repo, sha: git.sha, maxAttempts: opts.ciAttempts || 30 })

  // Stage 2: Vercel (only if CI green and project is Vercel)
  if (report.ci.status === 'green' || report.ci.status === 'unknown') {
    report.vercel = await pollVercel({ maxAttempts: opts.vercelAttempts || 60 })
  } else {
    report.vercel = { status: 'skipped', reason: 'CI not green' }
  }

  // Stage 3: URL
  if (report.vercel.status === 'ready' && report.vercel.url) {
    report.url = await curlUrl(report.vercel.url, { maxAttempts: opts.urlAttempts || 12 })
  } else if (report.vercel.status === 'n/a') {
    report.url = { status: 'n/a' }
  } else {
    report.url = { status: 'skipped', reason: 'no Vercel URL' }
  }

  // Overall
  const ciOk = report.ci.status === 'green' || report.ci.status === 'unknown'
  const vOk = report.vercel.status === 'ready' || report.vercel.status === 'n/a'
  const uOk = report.url.status === 'ok' || report.url.status === 'n/a'
  report.overall = ciOk && vOk && uOk ? 'SHIPPED' : 'FAILED'
  return report
}

module.exports = { verifyShip, gitInfo, isVercelProject }

// CLI: node ship-verify.js
if (require.main === module) {
  verifyShip().then(r => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.overall === 'SHIPPED' ? 0 : 1)
  })
}
