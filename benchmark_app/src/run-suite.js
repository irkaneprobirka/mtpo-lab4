const { loadDataset } = require('./data-loader');
const { manacher } = require('./manacher');

function runManacherSuite(filePath, repeats = 1) {
  const dataset = loadDataset(filePath);
  const results = [];

  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const item of dataset.cases) {
      const actual = manacher(item.input);
      if (item.expectedLongest !== undefined && actual.longest !== item.expectedLongest) {
        throw new Error(`${item.name}: expected longest '${item.expectedLongest}', got '${actual.longest}'`);
      }
      if (item.expectedCount !== undefined && actual.count !== Number(item.expectedCount)) {
        throw new Error(`${item.name}: expected count ${item.expectedCount}, got ${actual.count}`);
      }
      results.push({
        name: item.name,
        length: item.input.length,
        longest: actual.longest,
        count: actual.count
      });
    }
  }

  return { dataset, results };
}

module.exports = { runManacherSuite };
