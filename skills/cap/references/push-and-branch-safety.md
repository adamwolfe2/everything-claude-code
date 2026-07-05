# Push and Branch Safety

Use this reference only for modes that permit commit or push.

## Branch Intent Gate

Before committing in modes that permit commits, detect the current branch and the repo's default branch:

```bash
current_branch=$(git branch --show-current)
default_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
if [ -z "$default_branch" ]; then
  default_branch=$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF; exit}')
fi
if [ -z "$default_branch" ]; then
  default_branch=main
fi
```

If `current_branch` is empty, the repo is in detached HEAD. Stop before committing unless the user explicitly provides a branch target.

Resolve branch intent from explicit user language first:

- If the user said to commit or push to `main`, `master`, or the default branch, target the default branch.
- If the user said to keep the work on the current branch, open a PR, or push the branch, target the current branch.
- If the user said not to push, keep the run commit-only or stop after verification as requested.
- If the user says `continue` at the branch-target prompt, choose option `1`.

If branch intent is not explicit, ask one concise branch-target question after scope and verification are known but before `git commit`. Always use this numbered list, with option `1` first:

1. Cap, merge/land on the default branch, push, then clean up safe merged local branches. Also triggered by `continue`.
2. Cap and keep the work on the current branch, then push that branch.
3. Cap on a new feature branch from the default branch, then push that branch.
4. Commit only; do not push yet.
5. Verify only; do not commit or push.

Apply option `1` by branch state:

- On the default branch: commit and push the default branch, then run the branch cleanup flow.
- On a non-default branch: merge an already-committed branch into the default branch, or port only the exact intended uncommitted diff onto the default branch, then re-run required staged-diff/freshness checks before committing or pushing.
- On protected or release branches other than the default branch: ask before committing or pushing even if option `1` was selected.

Do not create branches, switch branches, merge, rebase, pull, or port diffs across branches without an explicit branch-target decision.

When moving a scoped diff from one branch to another, preserve exact staging boundaries. If unrelated dirty files, generated artifacts, lockfile churn, or branch divergence makes the move unsafe, stop and report the options instead of guessing.

## Push Default

After branch intent is resolved, a normal `cap` run pushes the resulting commit(s) to the chosen branch target. Shared branches such as `main`, `master`, `production`, or `release` are allowed only after the branch-intent gate and freshness checks pass.

Stop before pushing only when:

- the user explicitly asks for `cap dry-run`
- the user says not to push
- the user asks for local-only packaging
- branch intent is unresolved
- freshness/divergence/branch-protection checks fail

## Upstream Check

Check whether the branch has an upstream:

```bash
git rev-parse --abbrev-ref --symbolic-full-name @{u}
```

## Freshness Guard

Before pushing to a shared branch, fetch remote refs first:

```bash
git fetch --prune
git status --short --branch
```

If the branch has diverged or is behind its upstream, stop and report the divergence instead of attempting to push.

Do not rebase, merge, or pull automatically during cap unless the user explicitly asked for that.

## Push Rules

- If the chosen target is the current branch and upstream exists, push normally.
- If the chosen target is the current branch with no upstream, or a new branch, and `origin` exists, use `git push -u origin HEAD`.
- If the chosen target is the default branch from a non-default branch, move only the exact intended diff after explicit confirmation, then re-run the relevant staged-diff and freshness checks before pushing.
- If no suitable remote exists, stop and report that instead of guessing.
- Never force-push.
- If push is rejected because of non-fast-forward or branch protection, report the exact reason and stop.

## Branch Snapshot And Cleanup

Branch snapshot is not part of the default fast path. Run it for `cap release`, when the user asks about branch hygiene, or when branch state is relevant to the handoff.

```bash
git for-each-ref --sort=-committerdate refs/heads/ \
  --format='%(refname:short)|%(committerdate:relative)|%(subject)'
```

Summarize each branch in one line with:

- branch name
- how recently it changed
- latest commit subject

Flag branches untouched for 2 or more weeks as stale.

Branch cleanup is opt-in, except option `1` in the branch-target menu opts into safe merged-local cleanup after the default-branch push succeeds. Do not delete branches automatically outside those conditions.

When the user asks for cleanup, first report candidates:

```bash
git branch --merged "$default_branch"
git branch --no-merged "$default_branch"
```

If the local default branch is missing or stale, fetch first and compare against `origin/$default_branch` instead.

Cleanup rules:

- Never delete the current branch, the default branch, protected/release branches, or unmerged branches without an explicit branch-by-branch confirmation.
- For option `1`, local branches that are already merged into the default branch may be deleted with non-force deletion after the successful default-branch push, excluding the current/default/protected branches.
- Remote branch deletion requires a separate explicit request and fresh remote evidence.
- Use non-force deletion for local branches first. If Git refuses because a branch is unmerged, report that refusal instead of escalating to force deletion.
- After cleanup, run a fresh branch snapshot and report what changed.
