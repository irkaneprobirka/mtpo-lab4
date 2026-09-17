'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Показываем последнюю завершённую серию, не заставляя искать JSON вручную.
try {
  const reports = path.join(__dirname, '../reports');
  const series = fs.readdirSync(reports, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(reports, entry.name))
    .filter(directory => fs.existsSync(path.join(directory, 'summary.json')))
    .sort((a, b) => fs.statSync(path.join(b, 'summary.json')).mtimeMs - fs.statSync(path.join(a, 'summary.json')).mtimeMs);
  if (series.length === 0) throw new Error('Сначала выполните npm run benchmark');
  const directory = series[0];
  const raw = JSON.parse(fs.readFileSync(path.join(directory, 'raw.json'), 'utf8'));
  if (!raw.every(row => row.valid)) throw new Error('В последней серии есть ошибки. Проверьте журналы запуска');
  const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'));
  console.log('Результаты:', path.relative(path.join(__dirname, '..'), directory));
  console.log('Показаны медианы. CPU — нижняя оценка; память — наблюдаемый пик RSS.');
  console.table(summary.map(row => ({
    'Вход': row.dataset,
    'Фреймворк': row.framework,
    'Запусков': row.runs,
    'Время, мс': +row.wall_ms.toFixed(1),
    'CPU, мс': +row.cpu_ms.toFixed(1),
    'Память, MiB': +row.rss_mib.toFixed(1),
  })));
} catch (error) {
  console.error('Ошибка:', error.message);
  process.exitCode = 1;
}
