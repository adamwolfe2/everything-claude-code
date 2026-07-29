#!/usr/bin/env node
// Deterministic block/allow tests for scripts/hooks/destructive-git-guard.js
'use strict'
const path = require('path')
const { isDestructive, isEscaped } = require(path.join(__dirname, '..', 'scripts', 'hooks', 'destructive-git-guard.js'))

const MUST_BLOCK = [
  'git stash',
  'git stash push -u',
  'git stash save wip',
  'git stash -u',
  'git stash clear',
  'git stash drop',
  'cd /x && git stash',
  'git stash; npm test',
  'git reset --hard origin/main',
  'git checkout -- src/app.ts',
  'git clean -fd',
  'git clean -xdf',
  'git restore .',
  'git restore --staged --worktree src/',
  'rtk git stash',
]

// Recovery + inspection paths must stay open: blocking these would make it
// harder to undo the exact incident the guard exists to prevent.
const MUST_ALLOW = [
  'git status',
  'git stash list',
  'git stash show',
  'git stash pop',
  'git stash apply',
  'git stash apply stash@{0}',
  'git stash branch recover',
  'git reset HEAD~1',
  'git reset',
  'git reset --soft HEAD~1',
  'git checkout -b feat/x',
  'git checkout main',
  'git clean -n',
  'git clean --dry-run',
  'git diff > /tmp/x.patch',
  'git commit -m "x"',
  'git add .',
]

const blocked = (c) => isDestructive(c) && !isEscaped(c)

let failures = 0
for (const c of MUST_BLOCK) if (!blocked(c)) { console.log(`MISS (should block): ${c}`); failures++ }
for (const c of MUST_ALLOW) if (blocked(c)) { console.log(`FALSE POSITIVE (should allow): ${c}`); failures++ }
if (blocked('ALLOW_DESTRUCTIVE_GIT=1 git stash')) { console.log('MISS: escape hatch did not work'); failures++ }

const total = MUST_BLOCK.length + MUST_ALLOW.length + 1
console.log(failures === 0 ? `PASS ${total}/${total}` : `FAIL ${failures}/${total}`)
process.exit(failures === 0 ? 0 : 1)
