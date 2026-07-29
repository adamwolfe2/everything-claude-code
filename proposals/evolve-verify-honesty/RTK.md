# RTK - Rust Token Killer

**Usage**: Token-optimized CLI proxy (60-90% savings on dev operations)

## Meta Commands (always use rtk directly)

```bash
rtk gain              # Show token savings analytics
rtk gain --history    # Show command usage history with savings
rtk discover          # Analyze Claude Code history for missed opportunities
rtk proxy <cmd>       # Execute raw command without filtering (for debugging)
```

## Installation Verification

```bash
rtk --version         # Should show: rtk X.Y.Z
rtk gain              # Should work (not "command not found")
which rtk             # Verify correct binary
```

⚠️ **Name collision**: If `rtk gain` fails, you may have reachingforthejack/rtk (Rust Type Kit) installed instead.

## Never filter verification commands

Build/type/test/curl output is EVIDENCE — read it raw (`rtk proxy <cmd>`), never through the rtk filter.
Truncation is confirmed on rtk 0.37.2 (probed 2026-07-29): a 41,790-byte `curl` body came back as 597 bytes, plus a `(41790 bytes total)` note — the failing tail is the part you lose. Same class logged 2026-07-19.
Exit-code/parse honesty is a *reported* failure, not reproduced on 0.37.2: mistakes.jsonl 2026-07-24 (campaign-os) — `npm run build` read as green despite `Failed to compile`, `&&` chain continued into commit+push; research-queue has 4 more (next-build `Errors: 0` on a failing build, tsc `No errors found` from help text only, vitest `All parsing tiers failed`).
A plain `npm run build` DID propagate exit 1 through rtk 0.37.2 when re-probed — so treat the filter as untrustworthy for *output*, and never treat absent/short output as proof of green.

## Hook-Based Usage

All other commands are automatically rewritten by the Claude Code hook.
Example: `git status` → `rtk git status` (transparent, 0 tokens overhead)

Refer to CLAUDE.md for full command reference.
