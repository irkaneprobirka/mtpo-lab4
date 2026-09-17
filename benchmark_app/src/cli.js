'use strict';
const fs = require('node:fs');
const readline = require('node:readline/promises');
const { manacher } = require('./manacher');
const { readInput } = require('./json-input');

const HELP = `Алгоритм Манакера
  npm start                         — ввести строку в терминале
  npm start -- "abba"                — обработать строку
  npm start -- --text "abba"         — явно указать строку
  npm start -- --file data/example.json — прочитать JSON
  npm start -- --help                — показать справку
Формат файла: {"strings":["abba","топот",""]}
Пробелы и регистр сохраняются. При равных длинах выбирается левый ответ.`;

/** Разбор короткого списка команд отделён от ввода и вычислений. */
function parseArguments(args) {
  if (args.length === 0) return { mode: 'interactive' };
  if (args.length === 1 && args[0] === '--help') return { mode: 'help' };
  if (args.length === 1 && !args[0].startsWith('--')) {
    return { mode: 'text', value: args[0] };
  }
  if (args.length === 2 && args[0] === '--text') {
    return { mode: 'text', value: args[1] };
  }
  if (args.length === 2 && args[0] === '--file') {
    return { mode: 'file', value: args[1] };
  }
  throw new Error('Неверные аргументы. Используйте --help');
}

function formatResult(text, result) {
  return `Строка: ${JSON.stringify(text)}\n` +
    `Самый длинный палиндром: ${JSON.stringify(result.longest)}\n` +
    `Длина: ${result.length}\n` +
    `Число палиндромных вхождений: ${result.count}`;
}

async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.mode === 'help') {
    console.log(HELP);
    return;
  }

  let strings;
  if (options.mode === 'file') {
    strings = readInput(options.value);
  } else if (options.mode === 'text') {
    strings = [options.value];
  } else if (!process.stdin.isTTY) {
    // При перенаправлении читаем поток целиком, включая переводы строк.
    strings = [fs.readFileSync(0, 'utf8')];
  } else {
    const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      strings = [await terminal.question('Введите строку: ')];
    } finally {
      terminal.close();
    }
  }

  for (const text of strings) {
    console.log(formatResult(text, manacher(text)));
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Ошибка:', error.message);
    process.exitCode = 1;
  });
}
module.exports = { parseArguments, formatResult, main };
