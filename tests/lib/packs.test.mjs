// Pack resolution: explicit + auto-by-stack, opt-outs, and flattening to concrete items.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { desiredPacks, resolveItems } from '../../scripts/packs.mjs';

const defs = {
  vercel: { plugins: ['vercel@x'], auto: { stack: 'next' } },
  stripe: { mcp: ['stripe'] },
  video: { skills: ['hyperframes'] },
};
let passed = 0;
const t = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };

t('auto pack added by stack', () => assert.deepEqual(desiredPacks({ stack: 'Next 16' }, defs), ['vercel']));
t('explicit + auto, no duplicates', () =>
  assert.deepEqual(desiredPacks({ stack: 'Next', packs: ['stripe', 'vercel'] }, defs), ['stripe', 'vercel']));
t('packs_off beats auto', () => assert.deepEqual(desiredPacks({ stack: 'Next', packs_off: ['vercel'] }, defs), []));
t('no stack, no auto', () => assert.deepEqual(desiredPacks({}, defs), []));
t('flattens to items', () =>
  assert.deepEqual(resolveItems(['vercel', 'stripe', 'video'], defs), { plugins: ['vercel@x'], skills: ['hyperframes'], mcp: ['stripe'] }));

// the real registry must be internally consistent: every referenced pack exists
const reg = JSON.parse(readFileSync(new URL('../../projects.json', import.meta.url), 'utf8'));
t('registry packs all defined', () => {
  for (const p of reg.projects) for (const n of [...(p.packs ?? []), ...(p.packs_off ?? [])]) assert.ok(reg.packs[n], `${p.id} -> ${n}`);
});
t('registry ids unique', () => assert.equal(new Set(reg.projects.map((p) => p.id)).size, reg.projects.length));

console.log(`Passed: ${passed}\nFailed: 0`);
