const { loadDataset } = require('../../src/data-loader');
const { analyzeSample } = require('../../src/sample-analysis');

test('analyzes the configured input dataset', () => {
  const inputFile = process.env.TEST_INPUT_FILE || 'data/reference-input.json';
  const repeats = Number(process.env.TEST_REPEAT_COUNT || 1);
  const dataset = loadDataset(inputFile);
  let result;
  for (let i = 0; i < repeats; i += 1) {
    result = analyzeSample(dataset.values);
  }

  expect(result.count).toBe(dataset.size);
  expect(result.min).toBeLessThanOrEqual(result.max);
  expect(result.sum).toBeGreaterThanOrEqual(result.min * result.count);
  expect(result.uniqueCount).toBeGreaterThan(0);
});
