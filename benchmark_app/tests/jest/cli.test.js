const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArguments, formatResult } = require('../../src/cli');
const { withFile } = require('../helpers.cjs');

function run(args, input) {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../../src/cli.js'), ...args], {
    input, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.error, undefined, 'Дочерний процесс должен завершиться без тайм-аута');
  return result;
}

describe('Консольное приложение', () => {
  test('Без аргументов выбирается интерактивный ввод', () => {
    assert.deepEqual(parseArguments([]), { mode: 'interactive' });
  });
  test('Аргумент строки разбирается без преобразований', () => {
    assert.deepEqual(parseArguments([' a ']), { mode: 'text', value: ' a ' });
  });
  test('Явный ввод допускает строку, похожую на параметр', () => {
    assert.deepEqual(parseArguments(['--text', '--help']), { mode: 'text', value: '--help' });
  });
  test('Путь к JSON-файлу сохраняется', () => {
    assert.deepEqual(parseArguments(['--file', 'пример.json']), { mode: 'file', value: 'пример.json' });
  });
  for (const args of [['--unknown'], ['--file'], ['--text'], ['a', 'b'], ['--help', 'a']]) {
    test(`Неверные аргументы отклоняются: ${args.join(' ')}`, () => {
      assert.throws(() => parseArguments(args), /Неверные аргументы/);
    });
  }
  test('Формат результата содержит русские подписи и экранирует перевод строки', () => {
    const result = formatResult('a\na', { longest: 'a\na', length: 3, count: 4 });
    assert.equal(result, 'Строка: "a\\na"\nСамый длинный палиндром: "a\\na"\nДлина: 3\nЧисло палиндромных вхождений: 4');
  });

  // Это настоящие запуски CLI; их стоимость входит во все измерения одинаково.
  test('Консоль обрабатывает строку', () => {
    const result = run(['abba']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Самый длинный палиндром: "abba"/);
    assert.match(result.stdout, /вхождений: 6/);
    assert.equal(result.stderr, '');
  });
  test('Консоль обрабатывает пустую строку', () => {
    const result = run(['--text', '']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Длина: 0/);
    assert.match(result.stdout, /вхождений: 0/);
  });
  test('Консоль обрабатывает JSON-пакет', () => {
    withFile('{"strings":["abba","топот"]}', file => {
      const result = run(['--file', file]);
      assert.equal(result.status, 0);
      assert.equal((result.stdout.match(/Самый длинный палиндром:/g) || []).length, 2);
      assert.match(result.stdout, /"топот"/);
    });
  });
  test('Консоль читает перенаправленный поток без обрезки', () => {
    const result = run([], 'a\na');
    assert.equal(result.status, 0);
    assert.match(result.stdout, /вхождений: 4/);
  });
  test('Справка завершается успешно', () => {
    const result = run(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Алгоритм Манакера/);
  });
  test('Ошибка аргументов завершается кодом 1', () => {
    const result = run(['--unknown']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Ошибка: Неверные аргументы/);
    assert.equal(result.stdout, '');
  });
  test('Ошибка JSON завершается кодом 1 без частичного результата', () => {
    withFile('{"strings":["abba",5]}', file => {
      const result = run(['--file', file]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Элемент 2 должен быть строкой/);
      assert.equal(result.stdout, '');
    });
  });
  test('Ошибка чтения файла завершается кодом 1', () => {
    const result = run(['--file', 'data/несуществующий.json']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Не удалось прочитать/);
  });
});
