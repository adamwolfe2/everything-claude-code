#!/usr/bin/env node
// PostToolUse(Bash) hook: refuse to let a verification command read as GREEN
// when its output actually contains failure markers, was truncated, or was empty.
//
// Why this exists (mistakes.jsonl + research-queue, July 2026):
//   2026-07-24  `npm run build` piped through the rtk PreToolUse wrapper was read as
//               success despite "Failed to compile" in the output; the && chain
//               continued into commit + push and a broken build shipped (campaign-os).
//   2026-07-19  rtk wraps `curl` and truncates the body to ~500-600 bytes, appending
//               "(N bytes total)" + a tee-log path. Verified again on rtk 0.37.2:
//               a 41,790-byte response came back as 597 bytes.
//   research-queue x5  next-build reported "Errors: 0" on a failing build; tsc reported
//               "No errors found" when tsc had only printed its help text; the vitest
//               parser fell through to "All parsing tiers failed".
//
// This hook never blocks. It emits one stderr line so the model cannot silently
// convert RED into GREEN on exactly the commands used to prove correctness.

// Commands whose output is used as evidence of correctness.
const VERIFY_CMD =
  /\b(next build|run build|tsc\b|vitest|jest|playwright|pytest|cargo (build|test)|go (build|test)|curl )/;

// Markers that mean "this did NOT pass", regardless of exit code.
const FAILURE_MARKERS =
  /Failed to compile|error TS[0-9]|Type error|Tests?:.*[1-9][0-9]* failed|\bFAIL /;

// rtk (and other filters) annotate truncated output like: "... (41790 bytes total)"
const TRUNCATION_MARKER = /\((\d{4,})\s+bytes total\)|\[full output:/;

const PREFIX = '[VERIFY]';

function extractOutput(i) {
  const r = i.tool_response ?? i.tool_output ?? i.output;
  if (r == null) return '';
  if (typeof r === 'string') return r;
  if (typeof r === 'object') {
    const parts = [r.stdout, r.stderr, r.output, r.content, r.result];
    return parts.filter((p) => typeof p === 'string').join('\n');
  }
  return String(r);
}

let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  // Always pass the payload through untouched, whatever happens below.
  const passthrough = () => {
    process.stdout.write(d);
    process.exit(0);
  };

  let i;
  try {
    i = JSON.parse(d);
  } catch {
    return passthrough();
  }

  const cmd = i.tool_input?.command || '';
  if (!cmd || !VERIFY_CMD.test(cmd)) return passthrough();

  let out;
  try {
    out = extractOutput(i);
  } catch {
    return passthrough();
  }

  const warnings = [];

  if (FAILURE_MARKERS.test(out)) {
    warnings.push(
      `${PREFIX} Failure markers in output — do NOT treat as green; re-run via \`rtk proxy <cmd>\` and read raw output`,
    );
  }

  if (out.trim().length === 0) {
    warnings.push(
      `${PREFIX} Verification command produced NO output — empty output is not evidence of success; re-run via \`rtk proxy <cmd>\` and read raw output`,
    );
  } else if (TRUNCATION_MARKER.test(out)) {
    warnings.push(
      `${PREFIX} Output was truncated by a filter — the tail you did not see may contain the failure; re-run via \`rtk proxy <cmd>\` and read raw output`,
    );
  }

  for (const w of warnings) console.error(w);

  return passthrough();
});
