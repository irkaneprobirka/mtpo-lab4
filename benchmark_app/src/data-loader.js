const fs = require('node:fs');
const path = require('node:path');

function repeatToLength(pattern, length) {
  if (length <= pattern.length) {
    return pattern.slice(0, length);
  }
  return pattern.repeat(Math.ceil(length / pattern.length)).slice(0, length);
}

function normalizeCase(raw, index) {
  if (raw.input !== undefined) {
    return {
      name: raw.name || `case-${index + 1}`,
      input: String(raw.input),
      expectedLongest: raw.expectedLongest,
      expectedCount: raw.expectedCount,
      source: raw.source || ''
    };
  }

  const pattern = String(raw.pattern || 'abacaba');
  const length = Number(raw.length || pattern.length);
  return {
    name: raw.name || `generated-${index + 1}`,
    input: repeatToLength(pattern, length),
    expectedLongest: raw.expectedLongest,
    expectedCount: raw.expectedCount,
    source: raw.source || ''
  };
}

function loadJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const cases = Array.isArray(raw.cases) ? raw.cases : [];
  return {
    name: raw.name || path.basename(filePath),
    format: 'json',
    cases: cases.map(normalizeCase)
  };
}

function loadCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const header = lines.shift().split(',').map((item) => item.trim());
  const get = (columns, name) => columns[header.indexOf(name)] || '';
  const cases = lines.filter(Boolean).map((line, index) => {
    const columns = line.split(',').map((item) => item.trim());
    return normalizeCase({
      name: get(columns, 'name') || `csv-${index + 1}`,
      pattern: get(columns, 'pattern'),
      length: Number(get(columns, 'length')),
      expectedLongest: get(columns, 'expectedLongest') || undefined
    }, index);
  });

  return { name: path.basename(filePath), format: 'csv', cases };
}

function loadDataset(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.json') {
    return loadJson(filePath);
  }
  if (extension === '.csv') {
    return loadCsv(filePath);
  }
  throw new Error(`Unsupported input format: ${extension}`);
}

module.exports = { loadDataset, repeatToLength };
