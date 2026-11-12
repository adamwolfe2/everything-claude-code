// Workflow template for domain-lead-discovery step 2. Fill in TYPE, EXCLUDE, DIR and GROUPS,
// then pass it as the Workflow tool's `script`. Proven 2026-10-27 (print shops, 8 agents, about 4 min).
export const meta = {
  name: 'domain-harvest',
  description: 'Fan out agents to harvest company domains from public list pages',
  phases: [{ title: 'Harvest' }],
}
const TYPE = 'INDEPENDENT print shops (commercial, offset, digital, wide format, screen, label, direct mail)'
const EXCLUDE = 'franchises (AlphaGraphics, Minuteman Press, Sir Speedy, ...), online-only giants (Vistaprint, 4imprint, ...), equipment/ink vendors, design/marketing agencies, directory sites'
const DIR = '/Users/adamwolfe/cursive-data/YYYY-MM-DD-<slug>-discovery'
const GROUPS = [
  { key: 'r1-a', focus: 'Texas, Oklahoma, Louisiana, Arkansas, New Mexico, Kansas' },
  // ... 8 groups total: split by geography, then by depth (mid-size cities, other company types) in later rounds
]
const prompt = (g) => `Harvest website domains of ${TYPE}. Focus: ${g.focus}. Target 200-250 unique domains.

SPEED RULES:
- Do NOT open individual company websites. Only open LIST/DIRECTORY pages that name many companies at once, and read domains off them. WebSearch snippets showing name + domain count too.
- Productive sources: inven.ai "top-N-<type>-companies-in-<state>" pages; expertise.com/<st>/<city>/<category>; threebestrated.com; beststartup.us; business-journal "list of" pages; trade association member directories and award-winner lists.
- Search budget is shared across agents: prefer pages that yield many domains per fetch. Skip sources that 404.

EXCLUDE: ${EXCLUDE}.

OUTPUT: append JSONL to ${DIR}/${g.key}.jsonl as you go:
{"company":"...","domain":"example.com","city":"..." or null,"state":"XX","owner_name":null,"owner_title":null,"evidence_url":"list page url","shop_type":"..."}
domain = bare host, lowercase, no www. No guessed domains. Do not contact anyone or write anywhere else. Reply with rows written by state and the best 3 sources.`
return await parallel(GROUPS.map((g) => () => agent(prompt(g), { label: `harvest:${g.key}`, phase: 'Harvest', model: 'sonnet' })))
