// splitMemory: moves topic sub-bullets, gotchas, references and cross-project notes out of MEMORY.md
// without losing a line, and is idempotent.
import assert from 'node:assert';
import { splitMemory } from '../../scripts/apply-context.mjs';

let passed = 0;
let failed = 0;
const t = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); } catch (error) { failed += 1; console.log(`  ✗ ${name}: ${error.message}`); }
};

const SAMPLE = `# Project Memory — Index

Each project has its own detail file.

## Projects
- [Alpha](alpha.md) — ~/alpha · main
  - [alpha gotcha](alpha-gotcha.md) — never do X
- VendScout topic files: a, b,
  c, d.md
- [Beta](beta.md) — ~/beta

---

- [loose gotcha](loose.md) · [other](other.md)

## References
- [ref one](ref-one.md) — fact

## Cross-Project Preferences
- [Model tiering](model.md) — Fable plans
`;
const PREFS = '## Always-on preferences\n- Model tiering: Fable plans';

console.log('apply-context splitMemory:');
const out = splitMemory(SAMPLE, PREFS, '2026-09-27');
const norm = (l) => l.trim().replace(/^- (\([^)]*\) )?/, '');
t('no line is lost', () => {
  const both = `${out.memory}\n${out.references}`;
  for (const l of SAMPLE.split('\n').filter((x) => x.trim() && x.trim() !== '---' && !x.startsWith('# '))) {
    assert.ok(both.includes(norm(l)), `lost: ${l}`);
  }
});
t('MEMORY keeps only top-level project bullets + preferences', () => {
  assert.ok(!/^[ \t]+\S/m.test(out.memory), 'indented line left in MEMORY');
  assert.ok(out.memory.includes('- [Alpha](alpha.md)') && out.memory.includes('- [Beta](beta.md)'));
  assert.ok(out.memory.includes('## Always-on preferences'));
  assert.ok(!out.memory.includes('ref-one.md') && !out.memory.includes('loose.md'));
});
t('sub-bullets keep their parent in references.md', () => {
  assert.ok(out.references.includes('- (Alpha) [alpha gotcha](alpha-gotcha.md)'));
  assert.ok(out.references.includes('## References') && out.references.includes('## Cross-Project Preferences'));
});
t('idempotent: an already split MEMORY returns null', () => {
  assert.strictEqual(splitMemory(out.memory, PREFS, 'x'), null);
});
t('refuses a MEMORY without a Projects section', () => {
  assert.throws(() => splitMemory('# x\n- a\n', PREFS, 'x'), /Projects/);
});

console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
process.exit(failed ? 1 : 0);
