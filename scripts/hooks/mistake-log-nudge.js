#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): nudge Claude to /log-mistake when the session looks like a bug fix.
// Signal: fix/bug/patch/hotfix in the last 3 commit subjects or the branch name, or bug language in
// the transcript tail. Fires at most ONCE per session (per session_id), via additionalContext so
// Claude actually sees it (plain stdout/stderr on exit 0 never reaches the model).
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const STATE_DIR = path.join(os.homedir(), '.claude', 'state', 'mistake-nudge');
const COMMIT_RX = /\b(fix|bug|patch|hotfix)/i;
const TALK_RX = /(\bbug\b|broken|doesn'?t work|not working|failing|regression|crash|root cause)/;

function git(cwd, args) {
  try {
    return cp.execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (error) {
    return ''; // not a git repo or no commits: no signal, which is the correct answer
  }
}

function detect(input) {
  const cwd = input.cwd || process.cwd();
  if (COMMIT_RX.test(git(cwd, ['log', '-3', '--format=%s']))) return 'recent commit';
  if (COMMIT_RX.test(git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']))) return 'branch name';
  const tp = input.transcript_path;
  if (tp && fs.existsSync(tp)) {
    const size = fs.statSync(tp).size;
    const fd = fs.openSync(tp, 'r');
    const len = Math.min(size, 64 * 1024); // tail only; transcripts reach hundreds of MB
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    if (TALK_RX.test(buf.toString('utf8').toLowerCase())) return 'session context';
  }
  return null;
}

let d = '';
process.stdin.on('data', c => (d += c));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(d); } catch (error) {
    process.stderr.write(`[mistake-log] bad hook input: ${error.message}\n`);
    return;
  }
  const flag = path.join(STATE_DIR, String(input.session_id || 'unknown'));
  if (fs.existsSync(flag)) return;
  const reason = detect(input);
  if (!reason) return;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(flag, new Date().toISOString());
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `[mistake-log] This session looks like a bug fix (${reason}). When the fix is verified, run /log-mistake: root cause plus the CLASS of mistake and one enforceable check (lint rule, hook, test, or type) that would have caught it.`,
    },
  }));
});
