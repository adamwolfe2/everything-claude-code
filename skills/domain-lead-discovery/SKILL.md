---
name: domain-lead-discovery
description: "Find net-new, qualified cold-email leads for a Campaign OS / EmailBison campaign when GetLeads and Prospeo searches are exhausted: subagents harvest company websites from public list pages, GetLeads (then Prospeo) finds a verified decision maker per website, leads are filtered, sampled, imported into lead_universe and fed into the live campaign. Use when Adam says a campaign is low or out of leads, asks for more well-researched leads, or says to do what we did for print shops. Not for LinkedIn-only lists or client workspaces without Adam's approval."
---

# Domain lead discovery

Proven 2026-10-27 on a print-shop offer: 3 rounds, 24 agents, about 4,000 shop domains, several hundred owner leads that passed the fit check, under 100 Prospeo credits. Discovery runs on the Claude subscription. GetLeads lookups are covered by its unlimited plan. Prospeo is the only metered step.

**Maps first (11-11):** for offers with a Maps profile run `scripts/maps-pipeline.mts --offer "<offer>" [--states ..] [--verify-usd N] [--apply]` in ~/campaign-os (`GETLEADS_API_KEY` and `LOOPSTER_API_KEY` from the operator's env or Keychain; locations in private memory, not here). It exports Maps, finds owners, filters, verifies with MillionVerifier under a hard cap and imports only `valid`. Add a profile to `lib/maps/pipeline.ts` for a new offer. Use the agent harvest below only when Maps is exhausted.

## The pipeline (why each step exists)

| Step | Who | What | Why |
|---|---|---|---|
| 0. Check supply | me | Count the offer's remaining GetLeads sources and `campaign_ready` stock (`system_config.getleads_sources`, `lead_universe`). | Only run this when the normal searches are exhausted. |
| 1. Harvest domains | 8 Sonnet subagents (Workflow) | WebSearch plus WebFetch of **list pages only**, written to JSONL. | A database only contains people with LinkedIn profiles. Small companies' websites are on public list pages. |
| 2. Dedup | `discover-domains-enrich.mts` | Drop excluded companies (franchises etc.) and domains already in `lead_universe`. | About 40-60% are already known. Paying for those is waste. |
| 3. Find the buyer | same script | GetLeads `contacts/search {domains:[50]}`, one title-matched person per domain, VALID email only. | Hits about 43% of new domains. Needs no owner name. |
| 4. Fallback | `prospeo-pull.mts websites:<file>:<from>:<to>` | Prospeo owner/C-suite search by company website, verified emails only. | Adds about 5% more. About 1 credit per hit. |
| 5. Filter + sample | me | Noise filter on company name, title filter, then read 10-15 random rows before `--apply`. | Each round so far let something through: apparel shops, agencies, "Vice-President". |
| 6. Import | `ingest-getleads-csv.mts --apply` | Fresh-only insert, assigned to the offer, rule fit check (`lib/fit/rules.ts`). | The same gate every GetLeads lead goes through. |
| 7. Into EmailBison | keep-fed cron (or trigger it) | Attaches `campaign_ready` + `fit_verdict='pass'` leads to the offer's feed-target campaigns when runway < 7 days. | EmailBison attach has gotchas (async, skips leads in other campaigns). keep-fed already handles them. |

## Run it

All commands run from `~/campaign-os`. Data (personal data) lives in `~/cursive-data/<date>-<slug>-discovery/` and never goes in git.

**Keys** (never print them):
- Key locations live in private memory, never in this public repo.
- **Prospeo:** use the agency's own key only, never a client's. Check `account-information` before and after.
- **Cron:** `CRON_SECRET` from the app's local env (for triggering keep-fed).

1. **Define the ICP** with Adam, in one message, then proceed:
   - offer name (must exist in `feed_targets`)
   - company type + list-page search terms
   - buyer titles regex
   - non-buyer titles regex
   - company exclusions (franchises, giants, resellers)
   - noise words for the company-name filter
   - geography split into 8 groups
2. **Harvest:** run the Workflow in `references/harvest-workflow.js`, filling in `GROUPS`, the company type and the exclusions.
   - Round 1: one group per region.
   - Round 2: deeper pages and other company types.
   - Stop when most of an agent's finds are already in earlier files.
   - Run `wc -l` on the JSONL as agents finish.
3. **Look up decision makers:**
   ```bash
   GETLEADS_API_KEY=... /opt/homebrew/bin/tsx --env-file=.env.local scripts/discover-domains-enrich.mts \
     ~/cursive-data/<dir> ~/cursive-data/<dir>/roundN.csv \
     --titles 'owner|president|\bceo\b|founder|general manager|principal' \
     --not-titles 'vice[- ]?president|\bvp\b|sales|marketing|financ|\bcfo\b' \
     --exclude-company '<franchise|giant regex>' --industry '<GetLeads industry label>'
   ```
   The script re-reads every JSONL in the folder each round. Already-imported domains count as known, so reruns are safe.
4. **Prospeo fallback** (optional, metered):
   - Write the domains GetLeads missed to a JSON array.
   - Run `prospeo-pull.mts "websites:<file>:<from>:<to>" <out.csv> --max-pages 10` in slices of 100.
5. **Filter and sample:**
   - Python noise filter on `current_company_name`. Keep rows whose name still says the core trade.
   - Print 15 random rows: title | company | domain.
   - If more than 2 in 15 are wrong, tighten the filter and repeat. Do not import and clean up afterwards.
6. **Import:**
   - `ingest-getleads-csv.mts <csv> "<Offer>" discovery-<date>-rN --drop-title '<regex>'`. Dry run first, then `--apply`.
   - Report `ingested` / `fit.pass`.
7. **Feed:**
   - If the campaign isn't a feed target, run `npx tsx scripts/keep-fed-setup.mts --add-target "<Workspace>:<campaignId>:<Offer>"`, then repeat with `--confirm` after Adam approves.
   - Trigger: `GET https://send.amcollectivecapital.com/api/cron/keep-fed` with `Authorization: Bearer $CRON_SECRET`, or wait for the schedule (`14 12,15,18,21 * * *` UTC).
   - It only adds what the 7-day target needs. The rest stays in reserve.
8. **Verify live:**
   - `listCampaigns` for the workspace: status `active`, `total_leads` went up.
   - `POST /api/campaigns/{id}/stats {start_date,end_date}` gives sends per day.
   - Paste the numbers. "Imported" is not "sending".
9. **Log it:** one line in the project memory (rounds, domains, hits, fit-pass, credits, sources that worked).

## Rules learned the hard way

- **Agents never open individual company sites.** Round 1 did, and WebFetch rate-limited after about 30 fetches per agent. List pages give 20-100 domains per fetch.
- **Try GetLeads Google Maps places before any agents (11-09).** `count_places` / `export_places` by category (free on the unlimited plan, 25k rows per export). One food-distribution run: about 21k listings with websites gave about 14k new domains and about 3k owners in one run of `discover-domains-enrich.mts`, with no harvest agents. Before running, drop domains with invalid characters: one underscore domain makes the whole run fail.
- **Maps run details (11-11):** call the GetLeads MCP over HTTP with `~/cursive-data/.tools/glmcp.py` (JSON-RPC to the getleads MCP server config). Download exports with `rtk proxy curl` (plain curl through rtk wrote 0-byte files). Run domain lookups one at a time (two in parallel hit 429). Verify with the GetLeads bulk verifier: POST multipart `file`+`fileName` to `/api/email/validate/upload-sessions/<uploadId>?t=<token>`; it verifies what the wallet covers and `resume_email_validation` finishes after a top-up. First Maps batch was 10% invalid: never load unverified.
- **EmailBison pagination:** list endpoints ignore `per_page` (always 15 rows) and return 422 past page 1000. Build dedupe lists per campaign, not from workspace `/api/leads`.
- **Best list sources (print, 10-27):**
  - inven.ai `top-N-<type>-<industry>-companies-in-<state>` (best by far; states without a list return 404)
  - expertise.com `/<st>/<city>/<category>`
  - threebestrated.com
  - beststartup.us state lists (noisy)
  - business-journal "list of" pages
  - association member and award lists
- **No guessed domains or names.** Every row needs an `evidence_url`.
- **WebSearch budget is shared across agents** (about 200 calls per turn). 8 agents is the sweet spot. More agents means each gets fewer searches.
- **Prospeo keyword search (`company_keywords`) is junk** for this. On 10-27 it pulled nonprofits, design studios and packaging makers. Use website-scoped search only.
- **Title regex:** use `\bcto\b`, not `cto`, which matches "dire**cto**r". Use `vice[- ]?president`, not `vice president`.
- **Company emails only:** the email domain must equal the company domain. The fit rule checks this, and the Prospeo fallback enforces it.
- **Expect diminishing returns:** round 3 was about 70% already known. That's the signal to switch sources (browser on map listings or association directories via `browser-harness`) or markets, not to add agents.
- **Spend:** Prospeo credits only after a 5-domain test call. Report credits before and after. No `claude -p` crons. This skill runs when Adam starts it, or under `/away`.
- **Client workspaces:** only with Adam's explicit go, and with that client's own sourcing config.
