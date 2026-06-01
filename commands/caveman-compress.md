---
name: caveman-compress
description: Compress a file's word count without losing meaning — useful for CLAUDE.md, MEMORY.md, docs
---

Compress the file at $ARGUMENTS into caveman-speak to reduce input tokens.
Overwrite the original. Save a backup as `<filename>.original.md` before writing.

## Compression Rules

### Remove
- Articles: a, an, the
- Filler: just, really, basically, actually, simply, essentially, generally
- Pleasantries: "sure", "certainly", "of course", "happy to", "I'd recommend"
- Hedging: "it might be worth", "you could consider", "it would be good to"
- Redundant phrasing: "in order to" → "to", "make sure to" → "ensure", "the reason is because" → "because"
- Connective fluff: "however", "furthermore", "additionally", "in addition"
- Obvious connectives between facts

### Preserve EXACTLY (never modify)
- Code blocks (fenced ``` and indented)
- Inline code (`backtick content`)
- URLs and links (full URLs, markdown links)
- File paths (`/src/components/...`, `./config.yaml`)
- Commands (`npm install`, `git commit`, `docker build`)
- Technical terms (library names, API names, protocols, algorithms)
- Proper nouns (project names, people, companies)
- Dates, version numbers, numeric values
- Environment variables (`$HOME`, `NODE_ENV`)
- Identifiers (IDs, slugs, keys, hashes)

### Preserve Structure
- All markdown headings (keep exact heading text, compress body below)
- Bullet point hierarchy (keep nesting level)
- Numbered lists (keep numbering)
- Tables (compress cell text, keep structure)
- Frontmatter/YAML headers in markdown files

### Compress
- Short synonyms: "big" not "extensive", "fix" not "implement a solution for", "use" not "utilize"
- Fragments OK: "Run tests before commit" not "You should always run tests before committing"
- Drop "you should", "make sure to", "remember to" — just state the action
- Merge redundant bullets that say the same thing differently
- Keep one example where multiple examples show the same pattern
- Index-style files: each entry one line, push detail to per-topic files

## CRITICAL RULE
Anything inside ``` ... ``` must be copied EXACTLY. Do not remove comments,
remove spacing, reorder lines, shorten commands, or simplify anything inside
code blocks.

## Process
1. Read $ARGUMENTS.
2. Write `<filepath>.original.md` backup of original contents.
3. Apply the rules above; preserve all facts and identifiers.
4. Overwrite $ARGUMENTS with the compressed version.
5. Report before/after line and word counts.
