// Mocha загружает обычные тестовые файлы, но не запускает проверки.
const Mocha = require('mocha');
const path = require('node:path');
const mocha = new Mocha();
for (const name of ['algorithm', 'json', 'cli', 'workload']) {
  mocha.addFile(path.join(__dirname, '../tests/mocha', `${name}.test.js`));
}
mocha.loadFiles();
const tests = [];
mocha.suite.eachTest(test => tests.push({ group: test.parent.title, name: test.title }));
console.log(JSON.stringify(tests, null, 2));
