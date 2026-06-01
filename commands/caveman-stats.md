---
name: caveman-stats
description: Show caveman lifetime token-savings stats — total tokens saved, sessions, average compression ratio
---

Show caveman stats — total tokens saved, sessions, average compression ratio.

Read the lifetime history log at `~/.config/caveman/.caveman-history.jsonl`
(or wherever the caveman-stats script writes it). If the file does not exist,
tell the user no caveman runs have been recorded yet.

Output one short table:

| Metric | Value |
|--------|-------|
| Total tokens saved | … |
| Sessions counted | … |
| Avg compression ratio | … |
