#!/usr/bin/env node
/**
 * harness-state MCP server — exposes Adam's LOCAL harness state as queryable tools.
 *
 * Zero dependencies. Speaks MCP (JSON-RPC 2.0) over stdio. Built so ANY Claude session
 * — and remote routines that can't see the local FS directly — can query MEMORY,
 * decisions, telemetry, mistakes, research-queue, and per-project git status.
 *
 * This is the "custom MCP build" tier + it fixes the remote-blind limitation:
 * point a routine at this server (or run it locally) and the harness state is readable.
 *
 * Register: claude mcp add harness-state -- node <abs path to this file>
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const HOME = os.homedir();
const CLAUDE = path.join(HOME, '.claude');
const MEMORY_DIR = path.join(CLAUDE, 'projects', '-Users-adamwolfe', 'memory');
const DECISIONS_DIR = path.join(CLAUDE, 'knowledge', 'decisions');
const TELEMETRY = path.join(CLAUDE, 'telemetry.jsonl');
const MISTAKES = path.join(CLAUDE, 'mistakes.jsonl');
const RESEARCH_QUEUE = path.join(CLAUDE, 'research-queue.md');

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const readLines = (p) => read(p).split('\n').filter(Boolean);

// ---- tool implementations ---------------------------------------------------

function harness_memory({ project } = {}) {
  if (!project) {
    const idx = read(path.join(MEMORY_DIR, 'MEMORY.md'));
    return idx || 'MEMORY.md not found';
  }
  const slug = String(project).toLowerCase().replace(/[^a-z0-9]/g, '');
  let hit = '';
  try {
    for (const f of fs.readdirSync(MEMORY_DIR)) {
      if (f.toLowerCase().replace(/[^a-z0-9.]/g, '').includes(slug)) { hit = path.join(MEMORY_DIR, f); break; }
    }
  } catch {}
  return hit ? read(hit) : `No memory file matched "${project}". Try harness_memory with no project for the index.`;
}

function harness_decisions({ topic } = {}) {
  let files = [];
  try { files = fs.readdirSync(DECISIONS_DIR).filter((f) => f.endsWith('.md')); } catch { return 'No decisions dir'; }
  if (!topic) return 'Decisions on file:\n' + files.map((f) => '• ' + f).join('\n');
  const q = String(topic).toLowerCase();
  const hits = files
    .map((f) => ({ f, body: read(path.join(DECISIONS_DIR, f)) }))
    .filter((x) => x.f.toLowerCase().includes(q) || x.body.toLowerCase().includes(q));
  if (!hits.length) return `No decision matched "${topic}".`;
  return hits.map((h) => `### ${h.f}\n${h.body.slice(0, 1200)}`).join('\n\n---\n\n');
}

function harness_telemetry({ limit = 10 } = {}) {
  const lines = readLines(TELEMETRY);
  if (!lines.length) return 'telemetry.jsonl is empty';
  const recent = lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const usage = recent.filter((r) => r.event === 'session.usage' || r.type === 'session.usage' || r.output_tokens);
  const summary = {
    total_events: lines.length,
    shown: recent.length,
    recent: recent.map((r) => ({
      ts: r.ts || r.timestamp || '?',
      project: r.project || r.cwd || '?',
      output_tokens: r.output_tokens || r.output || undefined,
      turns: r.turns || r.messages || undefined,
      peak_ctx: r.peak_context || r.peak_ctx || undefined,
    })),
  };
  return JSON.stringify(summary, null, 2);
}

function harness_mistakes({ limit = 25 } = {}) {
  const lines = readLines(MISTAKES);
  if (!lines.length) return 'mistakes.jsonl is EMPTY — no logged bug classes yet. Feed it with /log-mistake after each fix.';
  return lines.slice(-limit).join('\n');
}

function harness_research_queue() {
  return read(RESEARCH_QUEUE) || 'research-queue.md not found';
}

function harness_project_status({ path: repo } = {}) {
  if (!repo) return 'Provide path to a git repo (absolute).';
  const dir = repo.startsWith('~') ? repo.replace('~', HOME) : repo;
  // per-call fault tolerance: a failing subcommand (e.g. no upstream) must not abort the rest
  const g = (c) => { try { return cp.execSync(`git -C "${dir}" ${c} 2>/dev/null`, { encoding: 'utf8' }).trim(); } catch { return ''; } };
  const branch = g('rev-parse --abbrev-ref HEAD');
  if (!branch) return `Not a git repo or unreadable: ${dir}`;
  return JSON.stringify({
    repo: dir,
    branch,
    last_commit: g("log -1 --format='%h %s'"),
    dirty_files: g('status --porcelain').split('\n').filter(Boolean).length,
    ahead_behind: g('rev-list --left-right --count @{u}...HEAD') || 'no upstream',
  }, null, 2);
}

const TOOLS = [
  { name: 'harness_memory', description: 'Read the cross-project MEMORY index, or a specific project\'s detail file. Args: {project?: string}', impl: harness_memory,
    inputSchema: { type: 'object', properties: { project: { type: 'string', description: 'project name e.g. trackr, cursive (omit for index)' } } } },
  { name: 'harness_decisions', description: 'Search the cross-project decisions log. Args: {topic?: string}', impl: harness_decisions,
    inputSchema: { type: 'object', properties: { topic: { type: 'string' } } } },
  { name: 'harness_telemetry', description: 'Summarize recent session telemetry (token/turn/context burn). Args: {limit?: number}', impl: harness_telemetry,
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'harness_mistakes', description: 'List logged mistakes (bug classes to prevent). Args: {limit?: number}', impl: harness_mistakes,
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'harness_research_queue', description: 'Read the research-queue (pending harness improvements from /digest).', impl: harness_research_queue,
    inputSchema: { type: 'object', properties: {} } },
  { name: 'harness_project_status', description: 'Git status (branch/last commit/dirty/ahead-behind) for a repo. Args: {path: string}', impl: harness_project_status,
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
];

// ---- JSON-RPC / MCP plumbing ------------------------------------------------

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return send({ jsonrpc: '2.0', id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'harness-state', version: '1.0.0' },
    } });
  }
  if (method === 'notifications/initialized') return; // no response to notifications
  if (method === 'tools/list') {
    return send({ jsonrpc: '2.0', id, result: {
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    } });
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === (params && params.name));
    if (!tool) return send({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Unknown tool' } });
    let text;
    try { text = tool.impl((params && params.arguments) || {}); }
    catch (e) { text = 'Error: ' + (e && e.message); }
    return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(text) }] } });
  }
  if (id != null) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
}

let buf = '';
process.stdin.on('data', (c) => {
  buf += c;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    handle(msg);
  }
});
process.stdin.on('end', () => process.exit(0));
