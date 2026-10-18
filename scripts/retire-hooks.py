#!/usr/bin/env python3
"""Remove the shell hooks the autopilot mod replaces, from config/hooks.json and all 3 accounts' settings.json.

Backs up each file first (*.bak-retire-<stamp>). Run: python3 ~/everything-claude-code/scripts/retire-hooks.py
Undo: copy the .bak-retire-<stamp> files back.
"""
import json
import os
import shutil
import time

RETIRE = ['context-budget.js', 'intent-router.js', 'read-discipline.js', 'mistake-log-nudge.js', 'verify-gate.js', 'ui-gate.js']
FILES = ['~/.claude/settings.json', '~/.claude-ma/settings.json', '~/.claude-aims/settings.json', '~/everything-claude-code/config/hooks.json']


def prune(hooks):
    out = {}
    for event, groups in hooks.items():
        kept = []
        for group in groups:
            hs = [h for h in group.get('hooks', []) if not any(r in (h.get('command') or '') for r in RETIRE)]
            if hs:
                kept.append({**group, 'hooks': hs})
        if kept:
            out[event] = kept
    return out


def count(hooks):
    return sum(len(g['hooks']) for gs in hooks.values() for g in gs)


stamp = time.strftime('%Y%m%d%H%M%S')
for rel in FILES:
    path = os.path.expanduser(rel)
    shutil.copy(path, f'{path}.bak-retire-{stamp}')
    data = json.load(open(path))
    pruned = {**data, 'hooks': prune(data['hooks'])}
    tmp = f'{path}.tmp'
    with open(tmp, 'w') as f:
        f.write(json.dumps(pruned, indent=2) + '\n')
    os.replace(tmp, path)
    print(f"{rel}: {count(data['hooks'])} -> {count(pruned['hooks'])} hooks")
