export const meta = {
  name: 'eval-fix-loop',
  description: 'Agent fixes its own failing tests in a worktree: run tests → fix → re-run, loop until green or attempts exhausted',
  whenToUse: 'When a test suite is red and you want an agent to drive it green unattended. Encodes the "agent fixes own tests" + "eval-driven loops" red tier.',
  phases: [{ title: 'Fix-Loop', detail: 'iterate test→fix→test until green' }],
}

// args: { repo: string, testCmd?: string, maxAttempts?: number }
const repo = (args && args.repo) || process_cwd_fallback()
const testCmd = (args && args.testCmd) || 'npm test'
const maxAttempts = (args && args.maxAttempts) || 5

function process_cwd_fallback() {
  return '.'
}

const RESULT = {
  type: 'object',
  properties: {
    green: { type: 'boolean' },
    failingCount: { type: 'number' },
    changedFiles: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    remainingFailures: { type: 'array', items: { type: 'string' } },
  },
  required: ['green', 'summary'],
}

phase('Fix-Loop')

let last = null
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  last = await agent(
    `You are driving a test suite to green in repo: ${repo}.
Attempt ${attempt}/${maxAttempts}.

1. Run \`${testCmd}\` and read the failures.
2. Fix the IMPLEMENTATION (never weaken or delete tests — that is a hard stop; if a test is genuinely wrong, report it in remainingFailures and stop).
3. Re-run \`${testCmd}\`.
4. Return green=true only if the suite passes. Otherwise return the failing count and what remains.

Make minimal diffs. Use immutable patterns. No console.log. Report changedFiles.`,
    { label: `fix:attempt-${attempt}`, phase: 'Fix-Loop', schema: RESULT, isolation: 'worktree' },
  )
  log(`Attempt ${attempt}: ${last.green ? 'GREEN' : `${last.failingCount ?? '?'} failing`}`)
  if (last.green) break
}

return last
