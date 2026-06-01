// Knowledge library — decisions index + search.
// Lives at ~/.claude/knowledge/ so it works in every project.
// Decisions stored as markdown files with YAML frontmatter; index.json caches metadata.

const fs = require('fs')
const path = require('path')
const os = require('os')

const KNOWLEDGE_DIR = path.join(os.homedir(), '.claude', 'knowledge')
const DECISIONS_DIR = path.join(KNOWLEDGE_DIR, 'decisions')
const INDEX_FILE = path.join(KNOWLEDGE_DIR, 'index.json')

function ensureDirs() {
  if (!fs.existsSync(DECISIONS_DIR)) fs.mkdirSync(DECISIONS_DIR, { recursive: true })
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (m) {
      let v = m[2].trim()
      if (v.startsWith('[') && v.endsWith(']')) {
        v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
      } else {
        v = v.replace(/^["']|["']$/g, '')
      }
      meta[m[1]] = v
    }
  }
  return { meta, body: match[2] }
}

function loadAll() {
  ensureDirs()
  const files = fs.readdirSync(DECISIONS_DIR).filter(f => f.endsWith('.md'))
  const decisions = []
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(DECISIONS_DIR, f), 'utf8')
      const { meta, body } = parseFrontmatter(content)
      decisions.push({
        slug: f.replace(/\.md$/, ''),
        path: path.join(DECISIONS_DIR, f),
        meta,
        body,
      })
    } catch {}
  }
  return decisions
}

function rebuildIndex() {
  const decisions = loadAll()
  const index = {
    builtAt: new Date().toISOString(),
    count: decisions.length,
    entries: decisions.map(d => ({
      slug: d.slug,
      title: d.meta.title || d.slug,
      project: d.meta.project || 'global',
      tags: Array.isArray(d.meta.tags) ? d.meta.tags : (d.meta.tags ? [d.meta.tags] : []),
      stack: Array.isArray(d.meta.stack) ? d.meta.stack : (d.meta.stack ? [d.meta.stack] : []),
      date: d.meta.date || d.slug.slice(0, 10),
      summary: d.body.split('\n').find(l => l.trim() && !l.startsWith('#')) || '',
    })),
  }
  ensureDirs()
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2))
  return index
}

function search(query, { project, tags, stack, limit = 10 } = {}) {
  const decisions = loadAll()
  const qWords = query.toLowerCase().split(/\s+/).filter(Boolean)
  const scored = decisions.map(d => {
    const hay = [
      d.meta.title || '',
      Array.isArray(d.meta.tags) ? d.meta.tags.join(' ') : (d.meta.tags || ''),
      Array.isArray(d.meta.stack) ? d.meta.stack.join(' ') : (d.meta.stack || ''),
      d.body,
    ].join('\n').toLowerCase()
    let score = 0
    for (const w of qWords) {
      const occurrences = (hay.match(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      score += occurrences
      if ((d.meta.title || '').toLowerCase().includes(w)) score += 5
    }
    if (project && d.meta.project === project) score += 3
    if (tags) {
      const dTags = Array.isArray(d.meta.tags) ? d.meta.tags : [d.meta.tags]
      for (const t of tags) if (dTags.includes(t)) score += 2
    }
    if (stack) {
      const dStack = Array.isArray(d.meta.stack) ? d.meta.stack : [d.meta.stack]
      for (const s of stack) if (dStack.includes(s)) score += 2
    }
    return { decision: d, score }
  })
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.decision)
}

function add({ title, project, tags = [], stack = [], body }) {
  ensureDirs()
  const date = new Date().toISOString().slice(0, 10)
  const slug = `${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
  const file = path.join(DECISIONS_DIR, `${slug}.md`)
  const frontmatter = [
    '---',
    `title: ${title}`,
    `project: ${project || 'global'}`,
    `date: ${date}`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    `stack: [${stack.map(s => `"${s}"`).join(', ')}]`,
    '---',
    '',
    body,
  ].join('\n')
  fs.writeFileSync(file, frontmatter)
  rebuildIndex()
  return { slug, path: file }
}

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) return rebuildIndex()
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
  } catch {
    return rebuildIndex()
  }
}

module.exports = { add, search, rebuildIndex, loadIndex, loadAll, KNOWLEDGE_DIR, DECISIONS_DIR, INDEX_FILE }

// CLI usage: node knowledge.js search "<query>" [--project X]
if (require.main === module) {
  const args = process.argv.slice(2)
  const cmd = args[0]
  if (cmd === 'search') {
    const query = args[1] || ''
    const results = search(query)
    console.log(JSON.stringify(results.map(r => ({ slug: r.slug, title: r.meta.title, project: r.meta.project })), null, 2))
  } else if (cmd === 'rebuild') {
    const idx = rebuildIndex()
    console.log(`Indexed ${idx.count} decisions`)
  } else if (cmd === 'list') {
    const idx = loadIndex()
    console.log(JSON.stringify(idx, null, 2))
  } else {
    console.log('Usage: node knowledge.js [search <query> | rebuild | list]')
  }
}
