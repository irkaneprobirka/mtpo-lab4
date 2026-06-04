const assert = require('node:assert/strict');
const { loadDataset } = require('../../src/data-loader');
const { analyzeSample } = require('../../src/sample-analysis');

describe('sample analysis', () => {
  it('analyzes the configured input dataset', () => {
    const inputFile = process.env.TEST_INPUT_FILE || 'data/reference-input.json';
    const repeats = Number(process.env.TEST_REPEAT_COUNT || 1);
    const dataset = loadDataset(inputFile);
    let result;
    for (let i = 0; i < repeats; i += 1) {
      result = analyzeSample(dataset.values);
    }

    assert.equal(result.count, dataset.size);
    assert.ok(result.min <= result.max);
    assert.ok(result.sum >= result.min * result.count);
    assert.ok(result.uniqueCount > 0);
  });
});
