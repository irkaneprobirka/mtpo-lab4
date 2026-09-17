// Самостоятельные тесты: утверждения выполняет Chai.
import { expect } from 'chai';
import { describe, it } from 'mocha';
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
  expect(result.error).to.equal(undefined);
  return result;
}
describe("Алгоритм Манакера", () => {
  for (const [name, input, longest, count] of examples) {
    it(name, () => {
      expect(manacher(input)).to.deep.equal({
        longest,
        length: Array.from(longest).length,
        count
      });
    });
  }
  const invalidInputs = [['пустое значение', null], ['неопределённое значение', undefined], ['число', 42], ['логическое значение', true], ['массив', []], ['объект', {}]];
  for (const [name, value] of invalidInputs) {
    it(`Отклоняется ${name}`, () => {
      expect(() => manacher(value)).to.throw(TypeError);
      expect(() => manacher(value)).to.throw('Вход должен быть строкой');
    });
  }

  // Девять отдельных тестов перебирают все строки каждой длины: всего 511 строк.
  for (let length = 0; length <= 8; length++) {
    it(`Сравнение с независимым перебором: длина ${length}`, () => {
      for (let number = 0; number < 2 ** length; number++) {
        const input = length === 0 ? '' : number.toString(2).padStart(length, '0');
        expect(manacher(input)).to.deep.equal(bruteForce(input));
      }
    });
  }
  for (const input of ['abacaba', 'abcaab', '😀а😀bb', 'a a', 'топот']) {
    it(`Обращение сохраняет число вхождений: ${input}`, () => {
      const reversed = Array.from(input).reverse().join('');
      expect(manacher(input).count).to.equal(manacher(reversed).count);
    });
  }
  it('Повторный вызов не зависит от предыдущих вычислений', () => {
    const before = manacher('abba');
    manacher('a'.repeat(100));
    expect(manacher('abba')).to.deep.equal(before);
  });
});
describe("Импорт JSON", () => {
  const valid = [['Одна строка', ['abba']], ['Пакет строк', ['abba', 'топот']], ['Пустая строка внутри пакета', ['']], ['Пробелы сохраняются', [' a ']], ['Переводы строк сохраняются', ['a\na']], ['Кавычки сохраняются', ['a"a']], ['Эмодзи сохраняются', ['😀а😀']], ['Повторяющиеся строки допустимы', ['a', 'a']]];
  for (const [name, strings] of valid) {
    it(name, () => expect(parseInput(JSON.stringify({
      strings
    }))).to.deep.equal(strings));
  }
  it('Маркер UTF-8 BOM допускается', () => {
    expect(parseInput('\uFEFF{"strings":["abba"]}')).to.deep.equal(['abba']);
  });
  const invalid = [['Повреждённый JSON', '{', /Некорректный JSON/], ['Пустой документ', '', /Некорректный JSON/], ['Значение null', 'null', /Поле strings/], ['Отсутствующее поле', '{}', /Поле strings/], ['Пустой пакет', '{"strings":[]}', /Поле strings/], ['Строка вместо массива', '{"strings":"abba"}', /Поле strings/], ['Массив без объекта', '["abba"]', /Поле strings/], ['Число внутри пакета', '{"strings":[1]}', /Элемент 1/], ['Значение null внутри пакета', '{"strings":[null]}', /Элемент 1/], ['Объект внутри пакета', '{"strings":[{}]}', /Элемент 1/], ['Ошибка во втором элементе', '{"strings":["abba",false]}', /Элемент 2/]];
  for (const [name, content, message] of invalid) {
    it(name, () => expect(() => parseInput(content)).to.throw(message));
  }
  it('Файл читается и передаётся алгоритму', () => {
    withFile('{"strings":["abba",""]}', file => {
      expect(readInput(file).map(manacher)).to.deep.equal([{
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
  it('Расширение JSON распознаётся без учёта регистра', () => {
    withFile('{"strings":["a"]}', file => expect(readInput(file)).to.deep.equal(['a']), '.JSON');
  });
  it('Другой формат файла отклоняется', () => {
    withFile('abba', file => expect(() => readInput(file)).to.throw(/расширение .json/), '.txt');
  });
  it('Отсутствующий файл даёт понятное сообщение', () => {
    expect(() => readInput('data/несуществующий.json')).to.throw(/Не удалось прочитать JSON-файл/);
  });
  it('Повреждённый файл не доходит до вычислений', () => {
    withFile('{', file => expect(() => readInput(file)).to.throw(/Некорректный JSON/));
  });
});
describe("Консольное приложение", () => {
  it('Без аргументов выбирается интерактивный ввод', () => {
    expect(parseArguments([])).to.deep.equal({
      mode: 'interactive'
    });
  });
  it('Аргумент строки разбирается без преобразований', () => {
    expect(parseArguments([' a '])).to.deep.equal({
      mode: 'text',
      value: ' a '
    });
  });
  it('Явный ввод допускает строку, похожую на параметр', () => {
    expect(parseArguments(['--text', '--help'])).to.deep.equal({
      mode: 'text',
      value: '--help'
    });
  });
  it('Путь к JSON-файлу сохраняется', () => {
    expect(parseArguments(['--file', 'пример.json'])).to.deep.equal({
      mode: 'file',
      value: 'пример.json'
    });
  });
  for (const args of [['--unknown'], ['--file'], ['--text'], ['a', 'b'], ['--help', 'a']]) {
    it(`Неверные аргументы отклоняются: ${args.join(' ')}`, () => {
      expect(() => parseArguments(args)).to.throw(/Неверные аргументы/);
    });
  }
  it('Формат результата содержит русские подписи и экранирует перевод строки', () => {
    const result = formatResult('a\na', {
      longest: 'a\na',
      length: 3,
      count: 4
    });
    expect(result).to.equal('Строка: "a\\na"\nСамый длинный палиндром: "a\\na"\nДлина: 3\nЧисло палиндромных вхождений: 4');
  });

  // Это настоящие запуски CLI; их стоимость входит во все измерения одинаково.
  it('Консоль обрабатывает строку', () => {
    const result = run(['abba']);
    expect(result.status).to.equal(0);
    expect(result.stdout).to.match(/Самый длинный палиндром: "abba"/);
    expect(result.stdout).to.match(/вхождений: 6/);
    expect(result.stderr).to.equal('');
  });
  it('Консоль обрабатывает пустую строку', () => {
    const result = run(['--text', '']);
    expect(result.status).to.equal(0);
    expect(result.stdout).to.match(/Длина: 0/);
    expect(result.stdout).to.match(/вхождений: 0/);
  });
  it('Консоль обрабатывает JSON-пакет', () => {
    withFile('{"strings":["abba","топот"]}', file => {
      const result = run(['--file', file]);
      expect(result.status).to.equal(0);
      expect((result.stdout.match(/Самый длинный палиндром:/g) || []).length).to.equal(2);
      expect(result.stdout).to.match(/"топот"/);
    });
  });
  it('Консоль читает перенаправленный поток без обрезки', () => {
    const result = run([], 'a\na');
    expect(result.status).to.equal(0);
    expect(result.stdout).to.match(/вхождений: 4/);
  });
  it('Справка завершается успешно', () => {
    const result = run(['--help']);
    expect(result.status).to.equal(0);
    expect(result.stdout).to.match(/Алгоритм Манакера/);
  });
  it('Ошибка аргументов завершается кодом 1', () => {
    const result = run(['--unknown']);
    expect(result.status).to.equal(1);
    expect(result.stderr).to.match(/Ошибка: Неверные аргументы/);
    expect(result.stdout).to.equal('');
  });
  it('Ошибка JSON завершается кодом 1 без частичного результата', () => {
    withFile('{"strings":["abba",5]}', file => {
      const result = run(['--file', file]);
      expect(result.status).to.equal(1);
      expect(result.stderr).to.match(/Элемент 2 должен быть строкой/);
      expect(result.stdout).to.equal('');
    });
  });
  it('Ошибка чтения файла завершается кодом 1', () => {
    const result = run(['--file', 'data/несуществующий.json']);
    expect(result.status).to.equal(1);
    expect(result.stderr).to.match(/Не удалось прочитать/);
  });
});
describe("Эталон и нагрузка", () => {
  const referenceDirectory = path.join(__dirname, '../data');
  const reference = readInput(path.join(referenceDirectory, 'reference-input.json'));
  const expected = JSON.parse(fs.readFileSync(path.join(referenceDirectory, 'reference-output.json'), 'utf8'));
  it('Ответ совпадает с отдельным эталонным файлом', () => {
    expect(reference.map(manacher)).to.deep.equal(expected);
  });
  const inputFile = process.env.TEST_INPUT_FILE || path.join(referenceDirectory, 'size-100.json');
  const inputs = readInput(inputFile);
  const repeats = Number(process.env.TEST_REPEAT_COUNT || 10);
  if (!Number.isSafeInteger(repeats) || repeats < 1) {
    throw new Error('Число повторов должно быть положительным целым');
  }
  for (const [index, input] of inputs.entries()) {
    const answer = expectedResult(input);
    it(`Нагрузочная строка ${index + 1}: длина ${input.length}`, () => {
      for (let repeat = 0; repeat < repeats; repeat++) {
        expect(manacher(input)).to.deep.equal(answer);
      }
    });
  }
});
