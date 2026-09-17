import { fileURLToPath } from 'node:url';
import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { manacher } from '../../src/manacher.js';
import { readInput } from '../../src/json-input.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Формулы верны только для двух семейств, создаваемых генератором.
function expectedResult(text) {
  const length = text.length;
  if (/^a+$/.test(text)) {
    return { longest: text, length, count: length * (length + 1) / 2 };
  }
  if (/^(?:ab)+a?$/.test(text)) {
    const longest = length % 2 === 0 ? text.slice(0, -1) : text;
    return { longest, length: longest.length, count: Math.floor((length + 1) ** 2 / 4) };
  }
  throw new Error('Нагрузочный вход должен состоять из повторов a или чередования ab');
}

describe('Эталон и нагрузка', () => {
  const referenceDirectory = path.join(__dirname, '../../data');
  const reference = readInput(path.join(referenceDirectory, 'reference-input.json'));
  const expected = JSON.parse(fs.readFileSync(path.join(referenceDirectory, 'reference-output.json'), 'utf8'));
  test('Ответ совпадает с отдельным эталонным файлом', () => {
    assert.deepEqual(reference.map(manacher), expected);
  });

  const inputFile = process.env.TEST_INPUT_FILE || path.join(referenceDirectory, 'size-100.json');
  const inputs = readInput(inputFile);
  const repeats = Number(process.env.TEST_REPEAT_COUNT || 10);
  if (!Number.isSafeInteger(repeats) || repeats < 1) {
    throw new Error('Число повторов должно быть положительным целым');
  }
  for (const [index, input] of inputs.entries()) {
    const answer = expectedResult(input);
    test(`Нагрузочная строка ${index + 1}: длина ${input.length}`, () => {
      for (let repeat = 0; repeat < repeats; repeat++) {
        assert.deepEqual(manacher(input), answer, 'Неверный ответ нагрузочного теста');
      }
    });
  }
});
