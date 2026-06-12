---
name: digest
description: Weekly closed-loop learning digest. Reads telemetry, knowledge, recent commits, modified skills, and pattern extractions. Proposes promotions, prunes, and skill rewrites. The flywheel that turns extraction into compounding improvement.
---

# /digest — Closed-loop weekly learning

The autopilot's LEARN cycle. Without this, extraction is a memory leak. With it, every week of work makes the next week sharper.

## When to run

- Weekly cadence (auto via `/schedule digest`)
- After any major feature ship
- When `/stats` shows unused or repeatedly-failing skills

## Arguments

`$ARGUMENTS`:
- `--since 7d` (default), `30d`, `90d`
- `--apply` — execute the proposed changes (otherwise report only)
- `--project <name>` — focus on one project

## Pipeline

### Step 1: Gather data

In parallel:
1. Telemetry summary via `lib/telemetry.summarize({ since })`
2. Knowledge index via `lib/knowledge.loadIndex()`
3. Recent commits across known projects (read MEMORY.md project list, walk each)
4. Modified-this-week skills and commands (`git log --since=...`)
5. Continuous-learning extracted patterns from `~/.claude/projects/*/memory/`
6. Mistake log — last 7 days of `~/.claude/mistakes.jsonl` (analyzed in Step 2.5)

### Step 2: Classify

For each skill in `~/.claude/skills/`:
- TRIGGERED_HOT: fired 10+ times → confirm rule set is sharp
- TRIGGERED_OK: 1-9 fires → no action
- DORMANT: 0 fires in window → candidate for archive
- FAILING: triggered but session ended in failure → review

For each command:
- DAILY: 5+ uses → core, keep tight
- WEEKLY: 1-4 uses → keep
- UNUSED: 0 uses in 30+ days → archive candidate

For each extracted pattern in continuous-learning:
- RECURRING: same pattern in 3+ sessions → PROMOTE to skill or rule
- ONE-OFF: single session → keep as note
- INVALIDATED: contradicted by later sessions → PRUNE

### Step 2.5: Mistake patterns (last 7 days)

Read `~/.claude/mistakes.jsonl`, keep entries from the last 7 days, and analyze. Use this node one-liner for reliable extraction (bash-3.2-safe, no jq needed):

```bash
node -e '
const fs=require("fs"),os=require("os"),p=require("path");
const f=p.join(os.homedir(),".claude","mistakes.jsonl");
if(!fs.existsSync(f)){console.log("NO_MISTAKES_FILE");process.exit(0)}
const cut=Date.now()-7*864e5;
const rows=fs.readFileSync(f,"utf8").trim().split("\n").filter(Boolean)
  .map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean)
  .filter(r=>Date.parse(r.date)>=cut);
if(!rows.length){console.log("NONE_THIS_WEEK");process.exit(0)}
const byTag={},byCause={};
for(const r of rows){(r.tags||[]).forEach(t=>byTag[t]=(byTag[t]||0)+1);
  const c=(r.root_cause||"").toLowerCase().trim();if(c)byCause[c]=(byCause[c]||0)+1;}
console.log("COUNT "+rows.length);
console.log("TAGS "+JSON.stringify(Object.entries(byTag).sort((a,b)=>b[1]-a[1])));
console.log("REPEAT_CAUSES "+JSON.stringify(Object.entries(byCause).filter(x=>x[1]>=2)));
console.log("ENTRIES "+JSON.stringify(rows.map(r=>({date:r.date.slice(0,10),repo:r.repo,bug:r.bug_summary,tags:r.tags}))));
'
```

Then in the report, include a **MISTAKE PATTERNS THIS WEEK** section:
- Count of mistakes logged, grouped by tag (most frequent first).
- Any **repeated root cause** (same cause 2+ times) — call these out loudly; they are systemic, not incidental.
- If any tag OR root cause repeats **2+ times**, surface ONE concrete rule to add to `~/.claude/CLAUDE.md` (propose the exact one-line rule; only write it with `--apply`).
- If the file is empty / NONE_THIS_WEEK, print "No mistakes logged this week — either a clean week or you're not running /log-mistake." (Don't fabricate.)

### Step 3: Propose

Output structured recommendations:

```
/digest — <date range>

CONTEXT
  Sessions:       <n>
  Total events:   <n>
  Ships succeeded: <n>
  Ships failed:    <n>
  Avg time-to-ship per slice: <n> min

WHAT WORKED
  - /cap success rate: 92% (last week 85%)
  - safe-feature-slice triggered correctly 8/8 times on Tier-1 work
  - Trackr shipped 12 slices, 0 rollbacks

WHAT FRICTION
  - CodeRabbit skipped 8 times (not authenticated)
  - /qa blocked 3 times (Codex login expired)
  - Empty-catch warnings increasing — taste-lint caught 6 this week

MISTAKE PATTERNS THIS WEEK
  - Logged: 5 mistakes — type-safety x3, edge-case x1, async x1
  - REPEATED ROOT CAUSE (systemic): "assumed value non-null without checking" x3
    → Propose CLAUDE.md rule: "Null/undefined is a case, not an edge case — handle it at the boundary."
  - (only proposes a rule when a tag/cause repeats 2+ times; writes it with --apply)

PROMOTE (recurring patterns ready to become skills/rules)
  1. "Drizzle migration in staging before main" — observed in trackr, taskspace, aims
     → New skill: drizzle-staging-migration
     → Apply with --apply

  2. "Empty catch in webhook handler" caught 4 times
     → Add to safe-feature-slice hard rules

PRUNE (low signal)
  - skills/eval-harness — 0 triggers in 30 days
  - commands/multi-execute — 0 uses in 30 days
  → Archive both with --apply

REWRITE (skills with description-trigger drift)
  - clerk skill: 3 valid Clerk questions but skill didn't fire — broaden trigger phrases

RESEARCH QUEUE (open questions to feed /research)
  - Best Next.js 16 pattern for Suspense + Clerk auth
  - Compare Drizzle vs Prisma for high-concurrency writes
```

### Step 4: --apply (if confirmed)

When `--apply` is passed:
1. Archive PRUNE candidates to `archive/skills/` or `archive/commands/`
2. Create new skills for PROMOTE candidates (scaffolded SKILL.md with extracted pattern)
3. Update REWRITE skill descriptions
4. Append research-queue items to `~/.claude/research-queue.md` (consumed by /research)

Commit each change individually with `chore(digest): <change>` so it's auditable.

## Hard rules

- Never auto-apply without `--apply`. Default is report only.
- Never archive a skill with >0 triggers in the window.
- Never PROMOTE a pattern observed in fewer than 3 sessions.
- All applied changes go through `/cap` for preflight.
- If telemetry is empty, output the report with a note "no telemetry yet" — do not silently exit.
- Never invent mistake patterns. If `mistakes.jsonl` has no entries in the window, say so plainly.
- Only propose a CLAUDE.md rule from a mistake pattern that repeats 2+ times in the window, and only write it with `--apply`.
