'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { manacher } = require('./manacher');
const { readInput } = require('./json-input');

// Эталонный выход хранится отдельно и не вычисляется исследуемым алгоритмом.
const dataDirectory = path.join(__dirname, '../data');
const inputs = readInput(path.join(dataDirectory, 'reference-input.json'));
const expected = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'reference-output.json'), 'utf8'));
assert.deepEqual(inputs.map(manacher), expected, 'Результат не совпадает с эталоном');
console.log('Проверка эталона пройдена:', inputs.length, 'примеров');
