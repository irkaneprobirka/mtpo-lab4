const { runManacherSuite } = require('../../src/run-suite');

test('Manacher suite passes on configured input', () => {
  const inputFile = process.env.TEST_INPUT_FILE || 'data/reference-palindromes.json';
  const repeats = Number(process.env.TEST_REPEAT_COUNT || 1);
  const { results } = runManacherSuite(inputFile, repeats);

  expect(results.length).toBeGreaterThan(0);
  expect(results.every((item) => item.longest.length >= 1)).toBe(true);
});
