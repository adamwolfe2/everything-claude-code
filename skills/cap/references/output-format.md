# Output Format

Use this structure for completed or stopped cap runs.

```text
## Cap Summary

### Scope
- Mode: fast | standard | verify | dry-run | only | watch | release
- Files to commit: ...
- Excluded unrelated changes: ...
- Verification repairs: <list or "none">

### Fast Mode
- Active: yes | no
- Focused checks run: ...
- Full-suite checks omitted: <list or "none">

### Checks
- Lint: PASS | FAIL | SKIPPED
- Types: PASS | FAIL | SKIPPED
- Tests: PASS | FAIL | SKIPPED
- Build: PASS | FAIL | SKIPPED
- UI/Browser: PASS | FAIL | SKIPPED
- Structural/Fallow: PASS | WARN | FAIL | SKIPPED

### Env Vars
- Synced | <n> local-only | <n> Vercel-only | Skipped (no Vercel)

### Commit
<sha> <type>(<scope>): <subject>

### Continuity
- Updated files: <list or "none">

### Branch Intent
- Current branch: <branch or detached>
- Default branch: <branch or unknown>
- Decision: default branch | current branch | new branch | PR/merge later | blocked
- Cleanup: skipped | snapshot only | candidates reported | completed

### Push
Pushed to <remote>/<branch> | Skipped | Blocked: <reason>

### Open Branches
- <branch> | <last activity> | <last commit>

### Deployment
Ready | Checked only | Recovering after failure | Error (blocked) | Canceled (blocked) | Building | Skipped

### Final Workspace
Clean | Dirty: <brief explanation>

### Behavior Preservation
- Previous intended behaviors preserved: ...
- Intentional behavior changes: ...
- Confidence: <0-100>

### Evidence
- Commands: <key commands run>
- Deployment: <url/id and final status, or "not applicable">
```

If the flow stops early, say exactly why:

- no relevant changes
- dry-run complete
- verify complete
- ambiguous staging scope
- explicit no-push / local-only request
- verification failure after repair attempts
- freshness/divergence block
- push rejection
- deployment recovery blocker

Keep the transcript concise. It should be enough for handoff/debugging, not a full terminal log.
