---
name: integration-parser
description: Build or fix a parser/mapper for any external API response (AppFolio, EmailBison, Stripe payloads, Cal.com, any third-party JSON). Use whenever writing code that maps an external response shape into app data, or when an integration "returns nothing" or silently under-ingests. Prevents the assumed-shape + silent-empty class (realos 0/288 rows for weeks; campaign-os empty since ship).
---

# integration-parser

Never write a parser against an imagined or documented-only shape. The shape comes from a captured real response. No exceptions.

## Steps

1. CAPTURE: hit the real endpoint (prod creds or staging) and save the raw response to `__fixtures__/<endpoint>.json` byte-for-byte. If you cannot capture a real response, STOP and say so — do not proceed from docs or memory.
2. WRITE the parser as a pure exported function: `parseX(raw: unknown): X[]`. Validate with a zod schema derived from the fixture, `.passthrough()` for fields you ignore.
3. LOUD DROPS: every skip/null/continue path increments a counter; log `parsed N, dropped M (reasons)` at the end. A 100% drop must be impossible to mistake for "no data". Never `catch { return [] }` on the read path.
4. TEST: pin the fixture — `expect(parseX(fixture)).toHaveLength(<real count>)` plus one field-level assertion per critical field (ids, timestamps, foreign keys).
5. VERIFY IN PROD: after ship, confirm ≥1 real row landed (query the table / check the counter log). An integration is not done until data is observed flowing.
6. WATERMARKS: if the sync uses a cursor/watermark, it must NOT advance past a phase that produced errors or zero rows unexpectedly (realos: watermark starved the failing phase).

## Example

EmailBison sequence steps: GET probe → fixture shows flat `data[]` (not the assumed nested `data[].sequence_steps[]`) → `parseSequenceStepsResponse` pure fn + zod → fixture test pins 3 steps → drop counter logs 0 dropped → prod query shows snapshots rows > 0. (This exact bug shipped silently and ran empty for weeks before the rule existed.)
