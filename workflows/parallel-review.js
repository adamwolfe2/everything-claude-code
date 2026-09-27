export const meta = {
  name: 'parallel-review',
  description: 'Agent-team review: claude code-reviewer + security-reviewer + codex, dedup, adversarially verify, rank',
  whenToUse: 'Before /cap on non-trivial diffs, or when the user asks for a deep multi-reviewer pass. Encodes the "parallel agents" + "agents managing agents" red tier.',
  phases: [
    { title: 'Review', detail: 'three independent reviewers over the same diff' },
    { title: 'Verify', detail: 'adversarially confirm each finding is real' },
  ],
}

// args: optional { scope?: string }  — what to review (defaults to "uncommitted changes")
// Accept {scope: "..."} OR a plain string. A malformed non-string/non-object arg fails loud —
// a silent fallback here once burned two full review runs on an empty default diff (2026-07-02).
const scope =
  typeof args === 'string' && args.trim()
    ? args
    : args && typeof args.scope === 'string' && args.scope.trim()
      ? args.scope
      : args == null
        ? 'the uncommitted changes (git diff HEAD)'
        : (() => { throw new Error('parallel-review: args must be a string or {scope: string}; got ' + JSON.stringify(args).slice(0, 200)) })()

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          file: { type: 'string' },
          line: { type: 'string' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'issue', 'fix'],
      },
    },
  },
  required: ['findings'],
}

// The codex lane must say whether it ran: an empty findings array from a dead lane reads as a clean review.
const CODEX_FINDINGS = {
  ...FINDINGS,
  properties: {
    ...FINDINGS.properties,
    status: { type: 'string', enum: ['ok', 'unavailable'] },
    reason: { type: 'string' },
  },
  required: ['status', 'findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string' },
  },
  required: ['isReal', 'confidence', 'reasoning'],
}

phase('Review')

const LENSES = [
  {
    key: 'quality',
    agentType: 'code-reviewer',
    prompt: `Review ${scope} for correctness bugs, maintainability, and dead code. Report SEVERITY: file:line — issue — fix. Be terse.`,
  },
  {
    key: 'security',
    agentType: 'security-reviewer',
    prompt: `Security review of ${scope}. OWASP, auth/ownership, IDOR, injection, secrets, SSRF. Report SEVERITY: file:line — issue — fix.`,
  },
  {
    key: 'codex',
    agentType: 'general-purpose',
    schema: CODEX_FINDINGS,
    prompt: `Run an INDEPENDENT external review of ${scope} using Codex CLI as a second opinion.
Run exactly this one Bash command, with <repo-root> from \`git rev-parse --show-toplevel\`:
~/codex-bridge/bin/codex-lane "<repo-root>" "Review ${scope}. For each issue output SEVERITY: file:line — issue — fix. <200 words. Focus on cross-tenant/IDOR/state bugs other reviewers miss. If clean, say so."
codex-lane closes stdin, uses its own temp files and time limits, and pauses itself on quota errors. Do not add \`timeout\`, \`&\`, pipes, or redirects, and do not call codex any other way. Give the Bash call a 660000 ms timeout.
- Output starts with "UNAVAILABLE:", the script is missing, or the command fails: return status "unavailable", reason = that line (or the error), findings = [].
- Otherwise: status "ok", findings parsed from the output (findings = [] only when Codex says the code is clean).`,
  },
]

const lanes = []

// pipeline: each reviewer's findings get verified the moment that reviewer finishes — no barrier
const reviewed = await pipeline(
  LENSES,
  (lens) => agent(lens.prompt, { label: `review:${lens.key}`, phase: 'Review', schema: lens.schema || FINDINGS, agentType: lens.agentType }),
  (result, lens) => {
    lanes.push({
      lane: lens.key,
      status: !result ? 'unavailable' : result.status || 'ok',
      reason: !result ? 'reviewer agent returned nothing' : result.reason || '',
    })
    return parallel(
      (result?.findings || []).map((f) => () =>
        agent(
          `Adversarially verify this ${lens.key} finding is REAL, not a false positive. Default to isReal=false if you cannot confirm from the actual code.\n\nFinding: ${f.severity} ${f.file}:${f.line || '?'} — ${f.issue}\nProposed fix: ${f.fix}`,
          { label: `verify:${f.file}`, phase: 'Verify', schema: VERDICT },
        ).then((v) => ({ ...f, source: lens.key, verdict: v })),
      ),
    )
  },
)

const confirmed = reviewed
  .flat()
  .filter(Boolean)
  .filter((f) => f.verdict?.isReal)
  .sort((a, b) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(a.severity) - ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(b.severity))

const down = lanes.filter((l) => l.status !== 'ok')
log(`Confirmed ${confirmed.length} real findings; ${lanes.length - down.length}/${LENSES.length} reviewers ran`)
for (const l of down) log(`UNAVAILABLE ${l.lane}: ${l.reason} (its silence is not a clean review)`)

return {
  lanes,
  confirmed,
  critical: confirmed.filter((f) => f.severity === 'CRITICAL'),
  high: confirmed.filter((f) => f.severity === 'HIGH'),
}
