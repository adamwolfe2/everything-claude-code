---
description: Initialize a workspace with full autonomous coding setup — explores the codebase, reads project context, and prepares for autonomous work with all agents and tools ready.
---

# Init Command

Full workspace initialization for autonomous coding. Run this when starting a new session in any project.

## What This Command Does

1. **Read project context** — CLAUDE.md, README, package.json, and any project config
2. **Explore the codebase** — understand structure, tech stack, patterns, entry points
3. **Check environment** — verify dependencies installed, env vars present, build works
4. **Load memory** — check for existing memory files from prior sessions
5. **Report status** — summarize what you found and what's ready

## Execution Steps

### Step 1: Read Project Context
Read these files if they exist (in parallel):
- `CLAUDE.md` (project root and any subdirectories)
- `README.md`
- `package.json` / `requirements.txt` / `Cargo.toml` / `go.mod`
- `.env.example`
- Any `CLAUDE.md` in parent directories

### Step 2: Explore Codebase Structure
- List top-level directories and key files
- Identify the framework and tech stack
- Count routes, components, modules
- Find entry points (main files, app directories)

### Step 3: Verify Environment
- Check if dependencies are installed (`node_modules/`, `venv/`, etc.)
- If not installed, install them
- Check for `.env.local` or equivalent — warn if missing
- Run a build check if the project has a build command
- Check git status and current branch

### Step 4: Load Memory
- Check `~/.claude/projects/*/memory/MEMORY.md` for this project
- Read any existing memory files for context from prior sessions
- Note any user preferences, project state, or feedback from memory

### Step 5: Status Report
Output a concise status report:

```
WORKSPACE INITIALIZED
=====================
Project: [name]
Stack: [framework, language, DB, etc.]
Status: [ready / needs setup / issues found]
Branch: [current git branch]
Dependencies: [installed / missing]
Environment: [configured / missing vars]
Memory: [loaded / none found]

Available agents: ceo, planner, architect, tdd-guide, code-reviewer,
                  security-reviewer, build-error-resolver, e2e-runner,
                  refactor-cleaner, doc-updater

Ready for work. What do you need?
```

## Important

- Do NOT ask for permission — just read, install, and set up
- Do NOT wait between steps — run everything possible in parallel
- Do NOT give time estimates
- If something is missing (env vars, deps), fix it or clearly state what's needed
- Keep the status report short and actionable
