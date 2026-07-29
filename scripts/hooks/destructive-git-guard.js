#!/usr/bin/env node
// destructive-git-guard.js — PreToolUse(Bash) guard.
//
// Blocks destructive git commands that discard uncommitted work.
// Rationale: repos are shared across concurrent sessions. A subagent's
// `git stash` wiped 28 uncommitted files (SteelTrap, 2026-07-23).
//
// Escape hatch: prefix the command with ALLOW_DESTRUCTIVE_GIT=1 (or export it)
// after confirming with Adam.
//
// Contract: read hook JSON on stdin. Allow => echo stdin, exit 0.
// Block => write reason to stderr, exit 1.

'use strict'

// Matches the destructive forms only. Deliberately does NOT match safe reads
// like `git stash list`, `git reset` (mixed, keeps worktree), `git checkout -b`,
// `git checkout <branch>`, or `git clean -n` (dry run).
const DESTRUCTIVE = [
  /\bgit\s+stash\b(?!\s+(list|show)\b)/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+checkout\s+--\s/,
  /\bgit\s+clean\s+-[a-zA-Z]*f/,
  /\bgit\s+restore\b/,
]

const MESSAGE = [
  '[Hook] BLOCKED: destructive git command.',
  "[Hook] Repos are shared across concurrent sessions — a subagent git stash wiped 28 uncommitted files (SteelTrap 2026-07-23).",
  '[Hook] Use a scratch branch or `git diff > /tmp/x.patch` instead.',
  '[Hook] Override only with an explicit ALLOW_DESTRUCTIVE_GIT=1 prefix after confirming with Adam.',
].join('\n')

function isEscaped(cmd) {
  // Inline env prefix (ALLOW_DESTRUCTIVE_GIT=1 git stash) or exported env var.
  return /\bALLOW_DESTRUCTIVE_GIT=1\b/.test(cmd) || process.env.ALLOW_DESTRUCTIVE_GIT === '1'
}

function isDestructive(cmd) {
  return DESTRUCTIVE.some((re) => re.test(cmd))
}

function main(raw) {
  let cmd = ''
  try {
    cmd = JSON.parse(raw)?.tool_input?.command || ''
  } catch {
    // Unparseable payload: fail open so a malformed hook event never wedges the session.
    process.stdout.write(raw)
    return
  }

  if (isDestructive(cmd) && !isEscaped(cmd)) {
    console.error(MESSAGE)
    process.exit(1)
  }
  process.stdout.write(raw)
}

if (require.main === module) {
  let data = ''
  process.stdin.on('data', (c) => (data += c))
  process.stdin.on('end', () => main(data))
}

module.exports = { isDestructive, isEscaped }
