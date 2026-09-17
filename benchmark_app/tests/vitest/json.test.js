import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { parseInput, readInput } from '../../src/json-input.js';
import { manacher } from '../../src/manacher.js';
import { withFile } from '../helpers.cjs';

describe('Импорт JSON', () => {
  const valid = [
    ['Одна строка', ['abba']], ['Пакет строк', ['abba', 'топот']],
    ['Пустая строка внутри пакета', ['']], ['Пробелы сохраняются', [' a ']],
    ['Переводы строк сохраняются', ['a\na']], ['Кавычки сохраняются', ['a"a']],
    ['Эмодзи сохраняются', ['😀а😀']], ['Повторяющиеся строки допустимы', ['a', 'a']],
  ];
  for (const [name, strings] of valid) {
    test(name, () => assert.deepEqual(parseInput(JSON.stringify({ strings })), strings));
  }
  test('Маркер UTF-8 BOM допускается', () => {
    assert.deepEqual(parseInput('\uFEFF{"strings":["abba"]}'), ['abba']);
  });
  const invalid = [
    ['Повреждённый JSON', '{', /Некорректный JSON/],
    ['Пустой документ', '', /Некорректный JSON/],
    ['Значение null', 'null', /Поле strings/],
    ['Отсутствующее поле', '{}', /Поле strings/],
    ['Пустой пакет', '{"strings":[]}', /Поле strings/],
    ['Строка вместо массива', '{"strings":"abba"}', /Поле strings/],
    ['Массив без объекта', '["abba"]', /Поле strings/],
    ['Число внутри пакета', '{"strings":[1]}', /Элемент 1/],
    ['Значение null внутри пакета', '{"strings":[null]}', /Элемент 1/],
    ['Объект внутри пакета', '{"strings":[{}]}', /Элемент 1/],
    ['Ошибка во втором элементе', '{"strings":["abba",false]}', /Элемент 2/],
  ];
  for (const [name, content, message] of invalid) {
    test(name, () => assert.throws(() => parseInput(content), message));
  }
  test('Файл читается и передаётся алгоритму', () => {
    withFile('{"strings":["abba",""]}', file => {
      assert.deepEqual(readInput(file).map(manacher), [
        { longest: 'abba', length: 4, count: 6 }, { longest: '', length: 0, count: 0 },
      ]);
    });
  });
  test('Расширение JSON распознаётся без учёта регистра', () => {
    withFile('{"strings":["a"]}', file => assert.deepEqual(readInput(file), ['a']), '.JSON');
  });
  test('Другой формат файла отклоняется', () => {
    withFile('abba', file => assert.throws(() => readInput(file), /расширение .json/), '.txt');
  });
  test('Отсутствующий файл даёт понятное сообщение', () => {
    assert.throws(() => readInput('data/несуществующий.json'), /Не удалось прочитать JSON-файл/);
  });
  test('Повреждённый файл не доходит до вычислений', () => {
    withFile('{', file => assert.throws(() => readInput(file), /Некорректный JSON/));
  });
});
