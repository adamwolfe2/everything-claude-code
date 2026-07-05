# REVIEW CHECKLIST — run before calling ANY task done

Order matters. Evidence: mistake #5 (tsc-clean reused after files changed → broken PR merged), 120 build-fix commits fleet-wide.

## 1. Gate order (after ALL files written, including tests)

1. `tsc --noEmit` — whole project, LAST-written-file inclusive. Never reuse an earlier clean run.
2. Lint (if configured — check CLAUDE.md COMMANDS).
3. Tests (if suite exists).
4. `build`.

## 2. Grep gates (mechanical, zero judgment — run them)

| Grep | Pass condition |
|---|---|
| `catch {}` / `catch (e) {}` / `catch { return []` in changed files | zero, or commented rationale |
| `console.log` in changed files | zero |
| `select('*')` in changed files | justified or narrowed |
| `process.env.` outside env module in changed files | zero for repos with env.ts |
| `: any` in changed files | zero in new code |

## 3. If the change touched a Tier-1 surface (money/auth/ownership/webhook/state)

- [ ] Every sibling route guarded: list + `[id]` + nested (campaign-os IDOR class)
- [ ] Scoping fails closed: `[]` → match-nothing, not no-filter (leasestack class)
- [ ] Multi-step auth/ownership writes atomic (one transaction) (realos class)
- [ ] Webhook auth = dedicated high-entropy token, never a domain id (orgId/slug) (leasestack class)
- [ ] Terminal/paid states guarded against regression (updateMany + NOT-terminal condition)
- [ ] Webhook writes awaited before response (serverless drops floating promises — cursive class)
- [ ] safe-feature-slice was applied; if not, stop and say so

## 4. If the change touched an external integration

- [ ] Parser is pure + exported, test fixture captured from a REAL response
- [ ] Every drop/skip path counts + warns — 100% drop must not look like "no data"
- [ ] Verified ≥1 real row written in prod (or staging) before calling it done

## 5. Scope + truth

- [ ] Diff contains ONLY files the task required (no drive-by edits without mention)
- [ ] Anything assumed is stated: "Assuming X — flag if wrong"
- [ ] Not presenting existing/completed work as new TODO (verify status first)
- [ ] `.env*` not staged; no hardcoded secret; env changes pushed to Vercel
- [ ] If a bug was fixed: /log-mistake + consider a regression eval

## 6. Report format

State: what changed (files), what was verified (which gates ran, results), what was NOT verified (be explicit), next suggested step.
