---
name: morning-briefing
description: Daily cross-project state summary. Reads MEMORY.md project list, polls git/CI/Vercel/Stripe for each, surfaces what needs attention. The "what should I work on today?" command.
---

# /morning-briefing — Daily cross-project status

One report covering every active project. Read this once per morning before starting work.

## Run via cron

```bash
/schedule morning-briefing --at "09:00" --tz "America/New_York"
```

Output goes to the chat. If running headless (cron-spawned), also write to `~/.claude/briefings/<date>.md`.

## What it checks (parallel)

For each project in MEMORY.md project list (TaskSpace, Trackr, Cursive, TBGC, Wholesail, Hook, CampusGTM, VendCFO, MyVSL, AMC, CreditOS, LeaseStack, MySLP, AIMS):

### Git
- Branch state (clean / dirty)
- Commits ahead of main on feature branches
- Stale branches (>7 days no commit)
- Open PRs (count + oldest)

### CI / GitHub Actions
- Latest workflow status (success / failed / running)
- Failed runs in last 24h

### Vercel (where applicable)
- Latest deployment state (Ready / Error / Building)
- Latest deployment URL + age
- Cost spike >20% vs last week

### Stripe (where applicable)
- New customers in last 24h
- Failed payments in last 24h
- MRR delta

### Telemetry
- Sessions in this project last 24h
- /cap ships in last 24h
- /cap blocks in last 24h

### Dependencies
- Any project with `pnpm audit` HIGH/CRITICAL CVE?

## Output format

```
/morning-briefing — <date>

GOOD NEWS
  Trackr shipped 3 features yesterday
  Cursive MRR +$240 last 24h
  AMC build cleared — pgvector RAG flow live

NEEDS ATTENTION
  TaskSpace
    - Open PR #142 untriaged for 5 days
    - CI failing on branch testing/2026-03-20 (TS error in lib/users.ts)
    - 1 high-severity CVE in lodash@4.17.20 — bump to 4.17.21

  Cursive
    - Stripe: 4 failed payments last 24h (1 dunning retry pending)
    - Vercel cost +28% — likely Inngest job loop
    - GHL webhook 500ing intermittently

  TBGC
    - Domain transfer still pending Rocky's action
    - No commits in 6 days

LOW-PRIORITY
  - 3 stale branches across {trackr, hook, campus-gtm}
  - AIMS: 12 commits ahead of main on phase-3 branch

PROPOSED FOCUS TODAY
  1. Fix TaskSpace #142 TS error (15 min)
  2. Triage Cursive Stripe failures (30 min)
  3. Inspect Cursive Vercel cost spike (20 min)
```

## Hard rules

- Parallelize all per-project polls (single message, many tool calls).
- Total runtime budget: 60 seconds.
- If a project is unreachable (no creds, repo gone), skip with a note — don't fail the whole briefing.
- Output is consumed by humans — keep it scannable. No raw JSON.
- Telemetry: log `event=briefing.run`, `event=briefing.attention_items` with counts.
