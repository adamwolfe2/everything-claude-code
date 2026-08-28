const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  FAIL ${name}: ${error.message}`);
    failed += 1;
  }
}

test('browser skill requires explicit permission before controlling user Chrome', () => {
  const skill = read('skills/browser-harness/SKILL.md');

  assert.match(skill, /user explicitly asks?[^\n]*(?:Chrome|browser)/i);
  assert.match(skill, /user(?:'s)? Chrome/i);
  assert.match(skill, /headless/i);
  assert.doesNotMatch(skill, /Always use browser-harness for any web interaction/i);
});

test('agent rules preserve explicit parallel-work authorization', () => {
  const rules = read('rules/agents.md');

  assert.match(rules, /explicitly asks?[^\n]*(?:subagents|parallel agents|parallel agent work)/i);
  assert.match(rules, /independent bounded work/i);
  assert.match(rules, /browser/i);
});

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
