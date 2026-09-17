'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** Единственный формат файла: { "strings": ["abba", "топот", ""] }. */
function parseInput(json) {
  let data;
  try {
    data = JSON.parse(json.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('Некорректный JSON');
  }

  if (!data || !Array.isArray(data.strings) || data.strings.length === 0) {
    throw new Error('Поле strings должно быть непустым массивом строк');
  }
  for (let index = 0; index < data.strings.length; index++) {
    if (typeof data.strings[index] !== 'string') {
      throw new Error(`Элемент ${index + 1} должен быть строкой`);
    }
  }
  // Ничего не обрезаем: пустая строка, пробелы и переводы строк значимы.
  return data.strings;
}

function readInput(file) {
  if (path.extname(file).toLowerCase() !== '.json') {
    throw new Error('Входной файл должен иметь расширение .json');
  }
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error('Не удалось прочитать JSON-файл');
  }
  return parseInput(content);
}

module.exports = { parseInput, readInput };
