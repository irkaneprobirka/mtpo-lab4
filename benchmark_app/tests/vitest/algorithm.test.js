import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { manacher } from '../../src/manacher.js';
import { bruteForce } from '../helpers.cjs';

// Ожидания простых примеров заданы явно: тест не вычисляет их через Манакера.
const examples = [
  ['Пустая строка', '', '', 0],
  ['Один символ', 'a', 'a', 1],
  ['Два разных символа', 'ab', 'a', 2],
  ['Два одинаковых символа', 'aa', 'aa', 3],
  ['Нечётная длина', 'aba', 'aba', 4],
  ['Чётная длина', 'abba', 'abba', 6],
  ['Три одинаковых символа', 'aaa', 'aaa', 6],
  ['Четыре одинаковых символа', 'aaaa', 'aaaa', 10],
  ['Нет длинных палиндромов', 'abc', 'a', 3],
  ['Вложенные палиндромы', 'abacaba', 'abacaba', 12],
  ['Левый максимум из эталона', 'babad', 'bab', 7],
  ['Палиндром внутри строки', 'cbbd', 'bb', 5],
  ['Длина пять', 'abcba', 'abcba', 7],
  ['Длина семь', 'racecar', 'racecar', 10],
  ['Русское слово топот', 'топот', 'топот', 7],
  ['Русское слово казак', 'казак', 'казак', 7],
  ['Эмодзи по краям', '😀а😀', '😀а😀', 4],
  ['Два эмодзи', '😀😀', '😀😀', 3],
  ['Символы, похожие на границы', '^#$', '^', 3],
  ['Повтор специального символа', '$$$', '$$$', 6],
  ['Запятая внутри', 'a,a', 'a,a', 4],
  ['Пробел внутри', 'a a', 'a a', 4],
  ['Переводы строк', '\na\n', '\na\n', 4],
  ['Регистр имеет значение', 'Аа', 'А', 2],
  ['Комбинируемый знак считается отдельно', 'е\u0308', 'е', 2],
  ['Палиндром у правого края', 'xabba', 'abba', 7],
];

describe('Алгоритм Манакера', () => {
  for (const [name, input, longest, count] of examples) {
    test(name, () => {
      assert.deepEqual(manacher(input), { longest, length: Array.from(longest).length, count });
    });
  }

  const invalidInputs = [
    ['пустое значение', null], ['неопределённое значение', undefined],
    ['число', 42], ['логическое значение', true], ['массив', []], ['объект', {}],
  ];
  for (const [name, value] of invalidInputs) {
    test(`Отклоняется ${name}`, () => {
      assert.throws(() => manacher(value), { name: 'TypeError', message: 'Вход должен быть строкой' });
    });
  }

  // Девять отдельных тестов перебирают все строки каждой длины: всего 511 строк.
  for (let length = 0; length <= 8; length++) {
    test(`Сравнение с независимым перебором: длина ${length}`, () => {
      for (let number = 0; number < 2 ** length; number++) {
        const input = length === 0 ? '' : number.toString(2).padStart(length, '0');
        assert.deepEqual(manacher(input), bruteForce(input), `Вход: ${input}`);
      }
    });
  }

  for (const input of ['abacaba', 'abcaab', '😀а😀bb', 'a a', 'топот']) {
    test(`Обращение сохраняет число вхождений: ${input}`, () => {
      const reversed = Array.from(input).reverse().join('');
      assert.equal(manacher(input).count, manacher(reversed).count);
    });
  }
  test('Повторный вызов не зависит от предыдущих вычислений', () => {
    const before = manacher('abba');
    manacher('a'.repeat(100));
    assert.deepEqual(manacher('abba'), before);
  });
});
