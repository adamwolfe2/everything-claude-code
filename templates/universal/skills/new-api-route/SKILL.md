---
name: new-api-route
description: Scaffold a Next.js API route (or webhook handler) with the canonical guard wrapper, zod validation, response envelope, and fail-closed scoping. Use whenever creating ANY new API route, server action with auth implications, or webhook endpoint, in any repo. Kills the top 3 fleet bug classes (auth gaps, unvalidated bodies, response drift).
---

# new-api-route

Target reader: a model with zero context. Follow steps exactly.

## Steps

1. Read the repo's CLAUDE.md FACTS block → auth system + guard helper path + ORM. If no guard helper exists, create `lib/api/guard.ts` first (withAuth/withAdmin wrapper matching the repo's auth — aimseod `lib/api/middleware.ts` is the reference).
2. Define the zod schema for the body/query FIRST. No route reads `req.json()` without `safeParse`.
3. Scaffold with the wrapper — never inline auth:
```ts
export const POST = withAuth(async (req, auth) => {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
  // every query carries the tenant filter from auth context — no unscoped reads
  const rows = await db.select({ id: t.id, name: t.name }) // explicit columns
    .from(t).where(and(eq(t.workspaceId, auth.workspaceId), ...));
  return NextResponse.json({ success: true, data: rows });
});
```
4. Sibling parity check: if this resource has other routes (list/[id]/nested), confirm EVERY one uses the same guard. Grep the resource dir. One unguarded sibling = IDOR.
5. Catch block: log with context (Sentry/logger per repo), return `{ success: false, error: "<generic>" }` with correct status. No `err.message` to client, no empty catch.
6. Webhook variant: auth = dedicated high-entropy token (header or path segment), NEVER an orgId/slug; verify signature if provider supports it; AWAIT all writes before responding (serverless drops floating promises); make handler idempotent (unique event id upsert); return 200 fast, heavy work async via queue/Inngest.
7. Tier-1 (money/state/ownership)? Stop and apply safe-feature-slice.

## Example

"Add an endpoint to update campaign status" → schema `{ status: z.enum([...]) }` → `withAuth` wrapper → `updateMany` with `workspaceId` filter AND `NOT IN (terminal states)` guard → sibling grep shows `campaigns/[id]/route.ts` unguarded → fix it in the same commit → checklist gates.
