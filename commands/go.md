---
name: go
description: One-word affirmative. Execute the latest proposal in the current session — preflight, build, ship, whatever is pending. Skips the re-ask cycle. Use after any session where Claude offered a plan ending in "Run? (yes / steer)".
---

# /go — Execute the latest proposal

Adam's single-word "yes." Honors the autopilot contract.

## When triggered

Any of: `/go`, `yes`, `go`, `ship`, `do it`, `lgtm`, `proceed`, `run it`, `sounds good`, `approved`.

## Behavior

1. **Look back** at the last meaningful proposal in this session.
2. **Restate it in one line** so Adam sees what's about to happen.
3. **Execute** — every step, with progress reporting.
4. **Report** results in compressed form (caveman-style).
5. **End with**: the new state + the next likely move.

## Anti-patterns (don't do these)

- Don't ask "Are you sure?" — `/go` already is the sure.
- Don't re-list the steps before doing them.
- Don't preamble. Just do.
- Don't take a different path than the one proposed. If you would, stop and re-propose first.

## If there's no clear proposal to execute

Say so in one line: `No active proposal. What are we doing?` Don't guess.
