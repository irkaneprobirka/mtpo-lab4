// Список регистрируемых тестов. Тела проверок здесь не выполняются.
const { registerTests } = require('../tests/shared.cjs');
const tests = [];
let group;
registerTests((name, register) => {
  group = name;
  register();
}, name => tests.push({ group, name }));
console.log(JSON.stringify(tests, null, 2));
