---
name: design-qa
description: Visual + a11y + perf gate. Runs Playwright visual snapshot, axe-core accessibility, and Lighthouse against the current dev URL. Use before /cap on customer-facing UI changes.
---

# /design-qa — Visual, a11y, perf gate

Catches what /qa (browser walkthrough) can't: visual regressions, contrast/ARIA violations, Lighthouse score drops.

## Prerequisites

- Dev server running (default `http://localhost:3000`)
- Playwright installed (`pnpm add -D @playwright/test`)
- `@axe-core/playwright` installed (`pnpm add -D @axe-core/playwright`)
- `lighthouse` CLI installed (`npm i -g lighthouse`) — optional, falls back if absent

## Arguments

`$ARGUMENTS`:
- `<paths>` — comma-separated routes to test (default: `/`)
- `--update-snapshots` — update visual baselines
- `--no-lighthouse` — skip Lighthouse
- `--budget perf=85,a11y=95` — fail thresholds

## Execution

1. **Setup** — confirm dev server reachable, snapshot baseline dir exists at `.claude/design-qa/snapshots/`

2. **Visual regression** (parallel per route):
   ```ts
   const page = await browser.newPage()
   await page.goto(url)
   await expect(page).toHaveScreenshot(`<route>.png`, { maxDiffPixels: 100 })
   ```

3. **Accessibility** (parallel per route):
   ```ts
   import AxeBuilder from '@axe-core/playwright'
   const results = await new AxeBuilder({ page }).analyze()
   ```
   Fail on any `violations.length > 0` with `impact in [critical, serious]`.

4. **Lighthouse** (sequential, on a clean page):
   ```bash
   lighthouse <url> --output=json --quiet --chrome-flags="--headless"
   ```
   Extract perf, a11y, best-practices, SEO scores.

5. **Aggregate report**:

```
/design-qa Summary

URL: http://localhost:3000

Routes tested: 3

Visual:
  /              OK (no diff)
  /dashboard     DIFF (12 pixels — review snapshot)
  /settings      OK

Accessibility:
  /              OK (0 critical)
  /dashboard     1 critical: color-contrast on `.text-muted` (4.1:1, requires 4.5:1)
  /settings      OK

Lighthouse:
  /              perf=92  a11y=98  bp=100  seo=100
  /dashboard     perf=78  a11y=89  bp=92   seo=95   ← below budget (perf<85, a11y<95)
  /settings      perf=88  a11y=97

Budget: perf>=85 a11y>=95

Result: FAIL (1 a11y critical, 1 perf/a11y budget miss)

Recommended next:
  - Fix color contrast in app/dashboard/<component>
  - Run /impeccable on /dashboard for perf review
  - Update snapshots after dashboard fix: /design-qa --update-snapshots
```

## Integration

If invoked as a sub-step of `/cap` (via `--design-qa` flag), block the commit on FAIL.

## Hard rules

- Never auto-update snapshots without `--update-snapshots`.
- Snapshots are stored under `.claude/design-qa/snapshots/` (not committed unless explicitly added to repo).
- Lighthouse runs are slow (~30s/route) — limit to ≤5 routes per invocation.
- Skip if dev server is not reachable; report and exit cleanly.
