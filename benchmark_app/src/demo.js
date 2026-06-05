const { runManacherSuite } = require('./run-suite');

const { results } = runManacherSuite('data/reference-palindromes.json', 1);

console.log('Авторский демонстрационный запуск алгоритма Манакера');
for (const item of results) {
  console.log(`${item.name}: length=${item.length}, longest='${item.longest}', count=${item.count}`);
}
