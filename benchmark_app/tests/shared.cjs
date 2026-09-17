// Общий каталог исключает случайные различия между тремя копиями тестов.
// Каждый вызов test регистрирует отдельный тест, видимый в отчёте раннера.
function registerTests(describe, test) {
  describe('Алгоритм Манакера', () => require('./algorithm.cjs')(test));
  describe('Импорт JSON', () => require('./json.cjs')(test));
  describe('Консольное приложение', () => require('./cli.cjs')(test));
  describe('Эталон и масштабируемая нагрузка', () => require('./workload.cjs')(test));
}
module.exports = { registerTests };
