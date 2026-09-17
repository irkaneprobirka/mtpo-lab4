// Обычная function сохраняет контекст Mocha для установки тайм-аута.
const { registerTests } = require('../shared.cjs');
registerTests(describe, (name, check) => it(name, function () {
  this.timeout(30000);
  return check();
}));
