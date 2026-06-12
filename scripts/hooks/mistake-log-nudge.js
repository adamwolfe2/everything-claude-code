#!/usr/bin/env node
// PostToolUse(Edit|Write): gentle nudge to log a mistake when a bug-fix is detected
// via recent git commit message / branch name OR session-transcript context.
// Lightweight: a nudge, not a blocker. 20-min cooldown so it never spams.
// Convention (matches other hooks here): message -> stderr; pass stdin through stdout.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

let d = '';
process.stdin.on('data', c => (d += c));
process.stdin.on('end', () => {
  let i = {};
  try { i = JSON.parse(d); } catch { process.stdout.write(d); process.exit(0); }
  const tool = i.tool_name || '';
  if (tool !== 'Edit' && tool !== 'Write') { process.stdout.write(d); process.exit(0); }

  const cwd = i.cwd || process.cwd();
  const rx = /\b(fix|bug|patch|hotfix)/i;
  let signal = false, reason = '';

  // 1) recent commit messages, then branch name
  try {
    const log = cp.execSync('git -C "' + cwd + '" log -3 --format=%s 2>/dev/null', { encoding: 'utf8' });
    if (rx.test(log)) { signal = true; reason = 'recent commit'; }
    if (!signal) {
      const br = cp.execSync('git -C "' + cwd + '" rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf8' });
      if (rx.test(br)) { signal = true; reason = 'branch name'; }
    }
  } catch {}

  // 2) transcript context (last ~40 lines)
  if (!signal && i.transcript_path && fs.existsSync(i.transcript_path)) {
    try {
      const tail = fs.readFileSync(i.transcript_path, 'utf8').trim().split('\n').slice(-40).join(' ').toLowerCase();
      if (/(\bbug\b|broken|doesn'?t work|not working|failing|regression|crash|throws|throwing|error when|root cause)/.test(tail)) {
        signal = true; reason = 'session context';
      }
    } catch {}
  }

  if (!signal) { process.stdout.write(d); process.exit(0); }

  // cooldown: don't nudge more than once per 20 min
  const flag = path.join(os.tmpdir(), 'mistake-nudge.flag');
  try {
    const last = fs.existsSync(flag) ? (parseInt(fs.readFileSync(flag, 'utf8'), 10) || 0) : 0;
    const now = Date.now();
    if (now - last < 20 * 60 * 1000) { process.stdout.write(d); process.exit(0); }
    fs.writeFileSync(flag, String(now));
  } catch {}

  console.error('[mistake-log] Looks like a bug fix (' + reason + '). Log this fix? Run /log-mistake to capture root cause + prevention.');
  process.stdout.write(d);
  process.exit(0);
});
