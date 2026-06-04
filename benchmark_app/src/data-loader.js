const fs = require('node:fs');
const path = require('node:path');

function extendValues(values, size) {
  const result = values.slice(0, size);
  for (let i = result.length; i < size; i += 1) {
    // Deterministic filler makes large inputs reproducible without huge files.
    result.push((i * 73 + 19) % 1009);
  }
  return result;
}

function loadJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const values = Array.isArray(raw.values) ? raw.values.map(Number) : [];
  const size = Number(raw.size || values.length);
  return {
    name: raw.name || path.basename(filePath),
    source: 'json',
    size,
    values: extendValues(values, size)
  };
}

function loadCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const header = lines.shift().split(',').map((item) => item.trim());
  const valueIndex = header.indexOf('value');
  if (valueIndex === -1) {
    throw new Error('CSV file must contain a value column');
  }
  const values = lines
    .filter(Boolean)
    .map((line) => Number(line.split(',')[valueIndex].trim()));

  return {
    name: path.basename(filePath),
    source: 'csv',
    size: values.length,
    values
  };
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

module.exports = { loadDataset, extendValues };
