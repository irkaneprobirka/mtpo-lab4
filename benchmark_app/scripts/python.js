'use strict';
// Единственное место, которое знает, как подготовить измеритель Python.
// Пользователь запускает npm-команду; окружение и psutil готовятся автоматически.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const tasks = { benchmark: 'benchmark.py', quality: 'check_mutations.py' };
const task = tasks[process.argv[2]];
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

function execute(command, args, quiet = false) {
  return spawnSync(command, args, {
    cwd: root, stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    ...(quiet ? { timeout: 10000 } : {}),
  });
}

try {
  if (!task) throw new Error('Неизвестная задача измерителя');
  if (!fs.existsSync(python)) {
    const candidates = process.platform === 'win32' ? [['py', '-3'], ['python']] : [['python3'], ['python']];
    const installed = candidates.find(([command, ...args]) =>
      execute(command, [...args, '-c', 'import sys; sys.exit(sys.version_info < (3, 10))'], true).status === 0);
    if (!installed) throw new Error('Для замеров установите Python 3.10 или новее, затем повторите npm-команду');
    console.log('Подготавливается окружение измерителя. Это нужно только при первом запуске.');
    const [command, ...args] = installed;
    if (execute(command, [...args, '-m', 'venv', '.venv']).status !== 0) {
      throw new Error('Не удалось подготовить окружение Python');
    }
  }
  if (execute(python, ['-c', 'import psutil; assert psutil.__version__ == "7.0.0"'], true).status !== 0) {
    console.log('Устанавливается средство измерения CPU и памяти.');
    if (execute(python, ['-m', 'pip', 'install', '-r', 'requirements.txt']).status !== 0) {
      throw new Error('Не удалось установить зависимости измерителя. Проверьте подключение к интернету');
    }
  }
  const result = execute(python, [task, ...process.argv.slice(3)]);
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error('Ошибка:', error.message);
  process.exitCode = 1;
}
