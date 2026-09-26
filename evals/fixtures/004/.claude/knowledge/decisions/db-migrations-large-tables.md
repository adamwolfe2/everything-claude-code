# DB migrations on large prod tables

Decision: never add a NOT NULL column directly to a table with real prod traffic.

1. Add the column nullable, no default (instant, no table rewrite/lock on Postgres 11+).
2. Backfill in small batches (a few thousand rows per transaction), with a delay
   between batches so replication/vacuum keeps up. Never one giant UPDATE.
3. Add the NOT NULL constraint as a separate migration using `NOT VALID` +
   `VALIDATE CONSTRAINT`, or re-check row counts before a plain `SET NOT NULL`
   so it doesn't full-scan under a long lock.
4. Land the whole sequence on a staging branch / preview DB first, verified with
   real row counts, before it touches prod.
5. Any RLS policy that reads the new column must be updated in the same
   migration set — a backfilled column that's NOT NULL but has no policy
   coverage yet is a silent data leak or a silent deny, depending on default-deny
   vs default-allow.

Applies to Drizzle, Prisma, or raw SQL — the batching/staging shape doesn't change.
