export const meta = {
  name: 'harness-evolve',
  description: 'Recursive self-improvement: read research-queue + telemetry + mistakes, propose harness mutations, eval-gate each on the frozen eval set, keep only winners. The flywheel.',
  whenToUse: 'Weekly (cron) or on demand to evolve ~/.claude skills/rules/agents. Encodes "self-improving loops" + "eval-driven loops" + "agents managing agents" red tier. HARNESS-ONLY scope by default.',
  phases: [
    { title: 'Propose', detail: 'mine signal sources for candidate mutations' },
    { title: 'Eval', detail: 'score each candidate against the frozen eval set' },
    { title: 'Gate', detail: 'keep winners, log losers' },
  ],
}

// args: { topN?: number, evalPath?: string }
const topN = (args && args.topN) || 3
const evalPath = (args && args.evalPath) || '/Users/adamwolfe/.claude/evals/harness-evals.jsonl'

const CANDIDATES = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'file under ~/.claude to mutate (skill/rule/agent/command)' },
          rationale: { type: 'string' },
          mutation: { type: 'string', description: 'concrete proposed change' },
          signalSource: { type: 'string', enum: ['research-queue', 'telemetry', 'mistakes', 'digest'] },
          expectedEvalDelta: { type: 'string' },
        },
        required: ['target', 'rationale', 'mutation', 'signalSource'],
      },
    },
  },
  required: ['candidates'],
}

const SCORE = {
  type: 'object',
  properties: {
    compositeScore: { type: 'number', description: '0-100' },
    baselineScore: { type: 'number' },
    delta: { type: 'number' },
    verdict: { type: 'string', enum: ['promote', 'reject'] },
    evidence: { type: 'string' },
    risks: { type: 'string' },
  },
  required: ['compositeScore', 'baselineScore', 'delta', 'verdict', 'evidence'],
}

phase('Propose')

const proposal = await agent(
  `Mine these signal sources and propose the ${topN} highest-leverage mutations to Adam's Claude harness (~/.claude). HARNESS-ONLY — never propose changes to product repos.

Signal sources to read:
- ~/.claude/research-queue.md  (explicit human + digest proposals)
- ~/.claude/telemetry.jsonl    (what's used vs ignored; failures)
- ~/.claude/mistakes.jsonl     (logged bug classes to prevent)
- ~/.claude/knowledge/decisions/ (prior decisions — don't re-litigate)

For each candidate name the exact target file, the concrete mutation, and which eval it should move. Prefer mutations that fix a recurring failure or surface an underused capability. Do NOT touch eval files (that would game the metric).`,
  { label: 'propose-mutations', phase: 'Propose', schema: CANDIDATES },
)

const candidates = (proposal.candidates || []).slice(0, topN)
log(`${candidates.length} candidate mutations proposed`)

// Each candidate: apply on a branch in a worktree, run the eval set, score vs baseline — fully parallel, no barrier
phase('Eval')
const scored = await pipeline(
  candidates,
  (c) =>
    agent(
      `Apply this harness mutation ON A NEW GIT BRANCH in an isolated worktree of the harness git repo (/Users/adamwolfe/everything-claude-code — ~/.claude symlinks into it), then evaluate.

TARGET: ${c.target}
MUTATION: ${c.mutation}
RATIONALE: ${c.rationale}

Steps:
1. Create branch evolve/<short-slug>.
2. Apply the mutation to ${c.target}.
3. Run the frozen eval set at ${evalPath} (each line is {id, prompt, grader, assert}). Run the baseline (main) too for comparison.
4. Compute a composite score 0-100 and the delta vs baseline.
5. Return verdict=promote ONLY if delta > 0 and no regression. Otherwise reject and reset.

Do not modify the eval file. Report evidence (which eval ids moved).`,
      { label: `eval:${c.target.split('/').pop()}`, phase: 'Eval', schema: SCORE, isolation: 'worktree' },
    ).then((s) => ({ candidate: c, score: s })),
)

phase('Gate')
const winners = scored.filter(Boolean).filter((s) => s.score.verdict === 'promote' && s.score.delta > 0)
const losers = scored.filter(Boolean).filter((s) => !(s.score.verdict === 'promote' && s.score.delta > 0))

log(`Gate: ${winners.length} promote, ${losers.length} reject`)

return {
  promote: winners.map((w) => ({ target: w.candidate.target, mutation: w.candidate.mutation, delta: w.score.delta, evidence: w.score.evidence })),
  reject: losers.map((l) => ({ target: l.candidate.target, reason: l.score.evidence, delta: l.score.delta })),
  note: 'HUMAN-IN-LOOP: promote branches are NOT auto-merged. Review each evolve/* branch and merge the winners.',
}
