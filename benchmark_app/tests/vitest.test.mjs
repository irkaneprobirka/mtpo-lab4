// Самостоятельные тесты: утверждения выполняет Vitest.
import { describe, test, expect } from 'vitest';
import { manacher } from '../src/manacher.js';
import { parseInput, readInput } from '../src/json-input.js';
import { parseArguments, formatResult } from '../src/cli.js';
import { withFile, bruteForce } from './helpers.cjs';
import { examples, expectedResult } from './cases.cjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

function run(args, input) {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../src/cli.js'), ...args], {
    input,
    encoding: 'utf8',
    timeout: 10000
  });
  expect(result.error).toBe(undefined);
  return result;
}
describe("Алгоритм Манакера", () => {
  for (const [name, input, longest, count] of examples) {
    test(name, () => {
      expect(manacher(input)).toStrictEqual({
        longest,
        length: Array.from(longest).length,
        count
      });
    });
  }
  const invalidInputs = [['пустое значение', null], ['неопределённое значение', undefined], ['число', 42], ['логическое значение', true], ['массив', []], ['объект', {}]];
  for (const [name, value] of invalidInputs) {
    test(`Отклоняется ${name}`, () => {
      expect(() => manacher(value)).toThrow(TypeError);
      expect(() => manacher(value)).toThrow('Вход должен быть строкой');
    });
  }

  // Девять отдельных тестов перебирают все строки каждой длины: всего 511 строк.
  for (let length = 0; length <= 8; length++) {
    test(`Сравнение с независимым перебором: длина ${length}`, () => {
      for (let number = 0; number < 2 ** length; number++) {
        const input = length === 0 ? '' : number.toString(2).padStart(length, '0');
        expect(manacher(input)).toStrictEqual(bruteForce(input));
      }
    });
  }
  for (const input of ['abacaba', 'abcaab', '😀а😀bb', 'a a', 'топот']) {
    test(`Обращение сохраняет число вхождений: ${input}`, () => {
      const reversed = Array.from(input).reverse().join('');
      expect(manacher(input).count).toBe(manacher(reversed).count);
    });
  }
  test('Повторный вызов не зависит от предыдущих вычислений', () => {
    const before = manacher('abba');
    manacher('a'.repeat(100));
    expect(manacher('abba')).toStrictEqual(before);
  });
});
describe("Импорт JSON", () => {
  const valid = [['Одна строка', ['abba']], ['Пакет строк', ['abba', 'топот']], ['Пустая строка внутри пакета', ['']], ['Пробелы сохраняются', [' a ']], ['Переводы строк сохраняются', ['a\na']], ['Кавычки сохраняются', ['a"a']], ['Эмодзи сохраняются', ['😀а😀']], ['Повторяющиеся строки допустимы', ['a', 'a']]];
  for (const [name, strings] of valid) {
    test(name, () => expect(parseInput(JSON.stringify({
      strings
    }))).toStrictEqual(strings));
  }
  test('Маркер UTF-8 BOM допускается', () => {
    expect(parseInput('\uFEFF{"strings":["abba"]}')).toStrictEqual(['abba']);
  });
  const invalid = [['Повреждённый JSON', '{', /Некорректный JSON/], ['Пустой документ', '', /Некорректный JSON/], ['Значение null', 'null', /Поле strings/], ['Отсутствующее поле', '{}', /Поле strings/], ['Пустой пакет', '{"strings":[]}', /Поле strings/], ['Строка вместо массива', '{"strings":"abba"}', /Поле strings/], ['Массив без объекта', '["abba"]', /Поле strings/], ['Число внутри пакета', '{"strings":[1]}', /Элемент 1/], ['Значение null внутри пакета', '{"strings":[null]}', /Элемент 1/], ['Объект внутри пакета', '{"strings":[{}]}', /Элемент 1/], ['Ошибка во втором элементе', '{"strings":["abba",false]}', /Элемент 2/]];
  for (const [name, content, message] of invalid) {
    test(name, () => expect(() => parseInput(content)).toThrow(message));
  }
  test('Файл читается и передаётся алгоритму', () => {
    withFile('{"strings":["abba",""]}', file => {
      expect(readInput(file).map(manacher)).toStrictEqual([{
        longest: 'abba',
        length: 4,
        count: 6
      }, {
        longest: '',
        length: 0,
        count: 0
      }]);
    });
  });
  test('Расширение JSON распознаётся без учёта регистра', () => {
    withFile('{"strings":["a"]}', file => expect(readInput(file)).toStrictEqual(['a']), '.JSON');
  });
  test('Другой формат файла отклоняется', () => {
    withFile('abba', file => expect(() => readInput(file)).toThrow(/расширение .json/), '.txt');
  });
  test('Отсутствующий файл даёт понятное сообщение', () => {
    expect(() => readInput('data/несуществующий.json')).toThrow(/Не удалось прочитать JSON-файл/);
  });
  test('Повреждённый файл не доходит до вычислений', () => {
    withFile('{', file => expect(() => readInput(file)).toThrow(/Некорректный JSON/));
  });
});
describe("Консольное приложение", () => {
  test('Без аргументов выбирается интерактивный ввод', () => {
    expect(parseArguments([])).toStrictEqual({
      mode: 'interactive'
    });
  });
  test('Аргумент строки разбирается без преобразований', () => {
    expect(parseArguments([' a '])).toStrictEqual({
      mode: 'text',
      value: ' a '
    });
  });
  test('Явный ввод допускает строку, похожую на параметр', () => {
    expect(parseArguments(['--text', '--help'])).toStrictEqual({
      mode: 'text',
      value: '--help'
    });
  });
  test('Путь к JSON-файлу сохраняется', () => {
    expect(parseArguments(['--file', 'пример.json'])).toStrictEqual({
      mode: 'file',
      value: 'пример.json'
    });
  });
  for (const args of [['--unknown'], ['--file'], ['--text'], ['a', 'b'], ['--help', 'a']]) {
    test(`Неверные аргументы отклоняются: ${args.join(' ')}`, () => {
      expect(() => parseArguments(args)).toThrow(/Неверные аргументы/);
    });
  }
  test('Формат результата содержит русские подписи и экранирует перевод строки', () => {
    const result = formatResult('a\na', {
      longest: 'a\na',
      length: 3,
      count: 4
    });
    expect(result).toBe('Строка: "a\\na"\nСамый длинный палиндром: "a\\na"\nДлина: 3\nЧисло палиндромных вхождений: 4');
  });

  // Это настоящие запуски CLI; их стоимость входит во все измерения одинаково.
  test('Консоль обрабатывает строку', () => {
    const result = run(['abba']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Самый длинный палиндром: "abba"/);
    expect(result.stdout).toMatch(/вхождений: 6/);
    expect(result.stderr).toBe('');
  });
  test('Консоль обрабатывает пустую строку', () => {
    const result = run(['--text', '']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Длина: 0/);
    expect(result.stdout).toMatch(/вхождений: 0/);
  });
  test('Консоль обрабатывает JSON-пакет', () => {
    withFile('{"strings":["abba","топот"]}', file => {
      const result = run(['--file', file]);
      expect(result.status).toBe(0);
      expect((result.stdout.match(/Самый длинный палиндром:/g) || []).length).toBe(2);
      expect(result.stdout).toMatch(/"топот"/);
    });
  });
  test('Консоль читает перенаправленный поток без обрезки', () => {
    const result = run([], 'a\na');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/вхождений: 4/);
  });
  test('Справка завершается успешно', () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Алгоритм Манакера/);
  });
  test('Ошибка аргументов завершается кодом 1', () => {
    const result = run(['--unknown']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Ошибка: Неверные аргументы/);
    expect(result.stdout).toBe('');
  });
  test('Ошибка JSON завершается кодом 1 без частичного результата', () => {
    withFile('{"strings":["abba",5]}', file => {
      const result = run(['--file', file]);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Элемент 2 должен быть строкой/);
      expect(result.stdout).toBe('');
    });
  });
  test('Ошибка чтения файла завершается кодом 1', () => {
    const result = run(['--file', 'data/несуществующий.json']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Не удалось прочитать/);
  });
});
describe("Эталон и нагрузка", () => {
  const referenceDirectory = path.join(__dirname, '../data');
  const reference = readInput(path.join(referenceDirectory, 'reference-input.json'));
  const expected = JSON.parse(fs.readFileSync(path.join(referenceDirectory, 'reference-output.json'), 'utf8'));
  test('Ответ совпадает с отдельным эталонным файлом', () => {
    expect(reference.map(manacher)).toStrictEqual(expected);
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
        expect(manacher(input)).toStrictEqual(answer);
      }
    });
  }
});
