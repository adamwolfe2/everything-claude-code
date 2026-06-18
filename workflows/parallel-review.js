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
const scope = (args && args.scope) || 'the uncommitted changes (git diff HEAD)'

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
    prompt: `Run an INDEPENDENT external review of ${scope} using Codex CLI as a second opinion. Execute:
codex exec --sandbox read-only --skip-git-repo-check --output-last-message /tmp/cx-review.txt "Review this diff. For each issue output SEVERITY: file:line — issue — fix. <200 words. Focus on cross-tenant/IDOR/state bugs other reviewers miss." -C <repo-root>
Then read /tmp/cx-review.txt and return its findings as structured output. If codex is unavailable, return an empty findings array.`,
  },
]

// pipeline: each reviewer's findings get verified the moment that reviewer finishes — no barrier
const reviewed = await pipeline(
  LENSES,
  (lens) => agent(lens.prompt, { label: `review:${lens.key}`, phase: 'Review', schema: FINDINGS, agentType: lens.agentType }),
  (result, lens) =>
    parallel(
      (result?.findings || []).map((f) => () =>
        agent(
          `Adversarially verify this ${lens.key} finding is REAL, not a false positive. Default to isReal=false if you cannot confirm from the actual code.\n\nFinding: ${f.severity} ${f.file}:${f.line || '?'} — ${f.issue}\nProposed fix: ${f.fix}`,
          { label: `verify:${f.file}`, phase: 'Verify', schema: VERDICT },
        ).then((v) => ({ ...f, source: lens.key, verdict: v })),
      ),
    ),
)

const confirmed = reviewed
  .flat()
  .filter(Boolean)
  .filter((f) => f.verdict?.isReal)
  .sort((a, b) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(a.severity) - ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(b.severity))

log(`Confirmed ${confirmed.length} real findings across ${LENSES.length} reviewers`)

return {
  confirmed,
  critical: confirmed.filter((f) => f.severity === 'CRITICAL'),
  high: confirmed.filter((f) => f.severity === 'HIGH'),
}
