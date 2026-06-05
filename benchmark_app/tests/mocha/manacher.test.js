const assert = require('node:assert/strict');
const { runManacherSuite } = require('../../src/run-suite');

describe('Manacher suite', () => {
  it('passes on configured input', () => {
    const inputFile = process.env.TEST_INPUT_FILE || 'data/reference-palindromes.json';
    const repeats = Number(process.env.TEST_REPEAT_COUNT || 1);
    const { results } = runManacherSuite(inputFile, repeats);

    assert.ok(results.length > 0);
    assert.ok(results.every((item) => item.longest.length >= 1));
  });
});
