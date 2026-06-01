# Performance Audit Master Prompt

Drop this into any project to find and fix speed issues. Ordered by impact.

## 1. COLD START / SERVERLESS

- Which API routes can move to edge runtime? (simple lookups, auth checks, redirects, proxies)
- Are any routes using unnecessarily large Node.js runtimes for simple operations?
- What's the maxDuration on crons/background jobs? Can they be shorter?
- Are there unused API routes still consuming serverless function slots?

## 2. DATABASE QUERIES (highest ROI)

- Find N+1 query patterns: loops with individual DB calls → batch with `.in()`
- Find `select('*')` calls → replace with explicit columns
- Find queries missing tenant/workspace filters (full table scans)
- Find sequential queries that could be `Promise.all()`'d
- Check for missing indexes on foreign keys and frequently filtered columns
- Find queries that fetch data the page never renders

## 3. BUNDLE SIZE

- Run `ANALYZE=true` build — what's the largest JS chunk?
- Find barrel imports (`import from index files` that pull entire libraries)
- Find components >500 lines that should be split + lazy loaded
- Find heavy libraries loaded on pages that don't need them (charts, editors, rich text)
- Are heavy components using `dynamic(() => import(), { ssr: false })`?
- Check for duplicate dependencies in the bundle

## 4. RENDERING & PERCEIVED SPEED

- Does every route have a `loading.tsx` skeleton?
- Are `useSearchParams` calls wrapped in `<Suspense>` boundaries? (Next.js 15 requirement)
- Is the main dashboard/home page streaming? (above-fold instant, below-fold in Suspense)
- Are images using `next/image` with proper `sizes`, `formats: ['avif', 'webp']`, and lazy loading?
- Are fonts subset and using `font-display: swap`?
- Are large lists virtualized? (only render visible rows)
- Is there a deferred value pattern for expensive re-renders?

## 5. CACHING

- Are expensive external API calls cached? (enrichment, lookups, third-party data)
- Is React Query / SWR configured with proper `staleTime` to prevent refetching?
- Are static/semi-static pages using ISR or static generation?
- Are API responses setting `Cache-Control` headers for CDN caching?
- Is there a DB-backed cache for frequently accessed but rarely changing data?

## 6. NETWORK & RESOURCE HINTS

- Are external API domains preconnected? (`<link rel="preconnect">`)
- Are critical resources preloaded? (`<link rel="preload">`)
- Is non-critical CSS loaded async? (`media="print" onload="media='all'"`)
- Are third-party scripts (analytics, chat widgets) loaded with `defer` or lazy?
- Are DNS lookups prefetched for domains used after page load?

## 7. API RESPONSE OPTIMIZATION

- Are paginated endpoints actually paginating? (not returning 10K rows)
- Are search endpoints debounced on the client? (not firing on every keystroke)
- Are webhook handlers returning 200 immediately and processing async? (Inngest, queues)
- Are file uploads streaming or buffering the entire file in memory?

## Fix Priority Framework

For each issue found:
1. **What the user feels** — "the leads page takes 5 seconds to load"
2. **Root cause** — "N+1 query fetching tags for each lead individually"
3. **Fix** — "batch query with `.in('lead_id', leadIds)`"
4. **Impact** — HIGH / MEDIUM / LOW
5. **Effort** — 5 min / 30 min / 2 hours

Always fix HIGH impact + LOW effort first. That's where 80% of speed gains come from.

## Patterns That Worked on Cursive

| Pattern | Before | After | Impact |
|---------|--------|-------|--------|
| Edge runtime on lookup routes | 1-3s cold start | <50ms | HIGH |
| Batch N+1 queries | 5-8s page loads | <1s | HIGH |
| select() explicit columns | 200KB payloads | 40KB payloads | MEDIUM |
| Streaming dashboard + skeletons | 3s blank screen | 500ms perceived | HIGH |
| Lazy load charts/editors | 800KB initial JS | 200KB initial JS | HIGH |
| loading.tsx on every route | flash of nothing | instant skeleton | MEDIUM |
| Suspense around useSearchParams | full client render | server render | MEDIUM |
| DB-backed intelligence cache | redundant API calls | cache hits | MEDIUM |
| VirtualList for long tables | 10K DOM nodes | ~20 DOM nodes | HIGH |
| Font subsetting + swap | 200KB fonts, FOUT | 30KB fonts, instant | LOW |
