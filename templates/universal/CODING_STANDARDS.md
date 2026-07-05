# CODING STANDARDS — Adam's Actual Conventions

Derived from real code across 7 repos (2026-07-03), not idealized. Where repos disagreed, the canonical choice below is Adam's own recorded decision or majority practice. A model reading only this file must produce code that matches the fleet.

## Canonical stack decisions (settled — do not re-litigate)

| Concern | Canonical | Source of ruling |
|---|---|---|
| ORM | Drizzle (new work). Prisma/supabase-js stay where they live | amcollective CLAUDE.md: "Drizzle, not Prisma — portfolio transitioning" |
| Auth | Clerk (new projects) | amcollective: "Clerk not Supabase — hard lesson from Cursive" |
| Package manager | pnpm (new projects); NEVER mix within a repo — check lockfile first | majority practice |
| Theme | Light only. Exception list: AIMS (dark/gold by design) | global pref |
| Icons | Lucide React. NO emojis anywhere in UI | global pref |
| Layout | root `app/` (no src/) for new projects; by-feature dirs + shared `ui/` | 5/7 repos; by-feature is the one universal convention |
| File names | kebab-case for all new files (`share-radar-chart.tsx`) | trackr/aimseod practice; stops the mixed-case drift in cursive/gtm |
| TS | `strict: true` minimum, no `any` in new code | 7/7 repos |

## Auth guards — wrapper, never inline

The inline guard is copy-pasted ~700× across repos and caused the top bug class (147 auth fix commits, IDOR in campaign-os, double-fixed privilege escalation in cursive).

BEFORE (trackr `app/api/reports/share/route.ts:15`, repeated 75× there, 335× in gtmengine):
```ts
const user = await currentUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

AFTER (aimseod `lib/api/middleware.ts` pattern — the one repo where sibling-route gaps are impossible):
```ts
export const GET = withAuth(async (request, auth) => { /* auth.userId guaranteed */ });
export const POST = withAdmin(async (request, auth) => { /* admin guaranteed */ });
```

Rules:
- Every repo gets ONE guard helper (`lib/api/guard.ts` or the repo's existing equivalent — check CLAUDE.md FACTS). All routes use it.
- When adding auth to a resource: guard list AND `[id]` AND nested routes in the same commit, or add a route-group `layout.tsx` fence. (campaign-os IDOR: guarded list, forgot detail.)
- Scoping helpers FAIL CLOSED: `[]` means "match nothing" (`{in: []}`), never "no filter". Distinguish `null` (unrestricted) from `[]` (restricted to nothing). (leasestack P1: `propertyIdsToWhere([])` → org-wide leak.)
- Multi-step auth/ownership writes go in ONE transaction. (realos: role set, scope write failed → org-wide access.)

## API responses — one envelope

Three incompatible `ApiResponse` shapes exist (cursive, gtmengine, aimseod). Canonical, for all new routes:

```ts
type ApiResponse<T> = { success: true; data: T; meta?: { total: number; page: number } }
                    | { success: false; error: string };  // user-safe message only
```

Catch blocks: log with context, return generic message, correct status. Never `err: any` + raw `err.message` to the client (am-collective-os `sync-mrr/route.ts:29` leaks internals).

## Errors — trackr is the reference implementation

trackr: 0 console.*, Sentry + typed errors. gtmengine: 668 raw console.error. Be trackr.

- NEVER `catch {}` or `catch(e){}` (empty). If intentionally ignoring, comment why: `catch { /* offline ping, best-effort */ }`.
- NEVER `catch { return [] }` on a read path without a loud counter/log — "empty forever" must be distinguishable from "working". (campaign-os: parser returned [] silently since ship day; realos: 0/288 rows for weeks looked like "no data".)
- Server errors → Sentry (or the repo's logger per CLAUDE.md). `console.log` never ships.

## Validation — zod at every boundary

- Every route that reads a body: `schema.safeParse(await req.json())` → 400 on fail. No bare `JSON.parse(rawBody)` used unvalidated (am-collective-os calcom webhook does this today; it's the anti-example).
- External API parsers: pure exported function + test fixture captured from a REAL response (copy bytes from prod probe, never write the fixture from docs/memory). See integration-parser skill.

## Database

- Explicit columns. `select('*')` only when genuinely all columns render (cursive has 482, payloads 5× oversize).
- No `await` DB call inside a for-loop — batch with `.in()` / `inArray()` / one upsert of the array (cursive: 465 loop-await sites; the workspace-settings step loop is the anti-example).
- Every query on tenant-owned data carries the workspace/org filter. No exceptions, even "internal" routes.
- Migrations: generated via the tool (`supabase migration new`, `drizzle-kit generate`) — never hand-authored timestamps; no manual BEGIN/COMMIT (vendhub RLS migration took 4 same-day fixes).

## Dates + money

96 timezone fix commits fleet-wide. Rules:
- Store UTC everywhere. Convert at render only. Never `new Date(dateString)` on a date-only string (parses as UTC midnight → off-by-one in negative offsets); use the repo's date util or `date-fns` explicit parsing.
- Day-bucketing for user-facing metrics uses the WORKSPACE timezone, stated in code comment.
- Money: integer cents in DB. Format via shared `formatCurrency` (Intl.NumberFormat) — do not re-implement (5+ copies exist; consolidate when touched).

## Canonical helpers (stop re-implementing)

`cn()` (twMerge+clsx), `formatCurrency`, response envelope, guard wrapper, env module. When touching a repo that has a divergent copy, converge it to the canonical shape in the same PR only if trivial; otherwise note in specs.

## Env

- Central `lib/env.ts` (t3-oss createEnv + zod, trackr pattern) for new projects. Direct `process.env` only inside that file.
- After ANY `.env.local` change: push to Vercel immediately (env-sync skill). Trim values — stray newlines corrupted OAuth redirect_uri (am-collective-os).

## Immutability + style

- New objects, never mutate inputs (`{...user, name}`).
- Files ≤800 lines, functions ≤50. Extract when crossed, don't drift.
- Comments: rationale-style at decision points ("Verify workspace membership FIRST"), not narration. JSDoc for shared lib functions only.

## Testing (honest floor, not aspiration)

- Reality: only aimseod runs tests in CI; flowline/am-collective-os have ~none. Do NOT invent a suite mid-task; check CLAUDE.md COMMANDS.
- Floor for every ship: `tsc --noEmit` (whole project, AFTER all files including tests are written — next build does not typecheck tests), lint, build.
- Where a suite exists: run it; new Tier-1 logic gets a test pinning the invariant (fail-closed scope, guard coverage, parser fixture).
- Never delete/weaken a test to go green.
