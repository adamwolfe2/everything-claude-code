import type { EngineInterface } from 'claude-code'

// Archived skills and commands: out of every session's listing, loadable on demand.
// ~/everything-claude-code/archive/{skills/<name>/SKILL.md,commands/<name>.md}

export type LibraryEntry = { name: string; path: string; description: string; words: string[] }

const STOP = new Set(
  'this that with from into your their them they when what which will would should could about after before every other than then there these those where while using used uses make makes need needs just only also more most such each some like over under once'.split(
    ' ',
  ),
)
// ponytail: keyword overlap, no stemming or embeddings. 6 hinted ~1% of 538 real prompts (3 hinted 12%,
// mostly false); naming a skill outright always clears it. Upgrade if hints miss obvious matches.
export const HINT_SCORE = 6

export function words(text: string): string[] {
  const all = text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []
  return [...new Set(all.filter(w => !STOP.has(w)))]
}

function description(text: string): string {
  // No frontmatter (the contexts/ files): the first heading describes it.
  return (/^description:\s*(.*)$/m.exec(text) ?? /^#\s+(.*)$/m.exec(text))?.[1]?.trim() ?? ''
}

export async function loadLibrary($: EngineInterface, home: string): Promise<LibraryEntry[]> {
  const root = `${home}/everything-claude-code/archive`
  const found: { name: string; path: string }[] = []
  if (await $.fs.exists(`${root}/skills`)) {
    for (const d of await $.fs.list(`${root}/skills`)) {
      const path = `${root}/skills/${d.name}/SKILL.md`
      if ((d.kind === 'dir' || d.isLink) && (await $.fs.exists(path))) found.push({ name: d.name, path })
    }
  }
  if (await $.fs.exists(`${root}/commands`)) {
    for (const f of await $.fs.list(`${root}/commands`)) {
      // Some archived commands are symlinks into contexts/.
      if (f.kind !== 'dir' && f.name.endsWith('.md')) found.push({ name: f.name.slice(0, -3), path: `${root}/commands/${f.name}` })
    }
  }
  return Promise.all(
    found.map(async ({ name, path }) => {
      const desc = description(await $.fs.read(path))
      return { name, path, description: desc, words: words(`${name.replace(/-/g, ' ')} ${desc}`) }
    }),
  )
}

/** Entries sharing words with `text`, best first; a word of the name counts double. */
export function matchLibrary(entries: LibraryEntry[], text: string): { entry: LibraryEntry; score: number }[] {
  const asked = new Set(words(text))
  return entries
    .map(entry => {
      const nameWords = new Set(entry.name.split('-'))
      const score = entry.words.reduce((n, w) => n + (asked.has(w) ? (nameWords.has(w) ? 2 : 1) : 0), 0)
      return { entry, score: asked.has(entry.name) ? score + 4 : score }
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
}
