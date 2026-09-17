// Jest предоставляет describe и test в окружении тестового файла.
const { registerTests } = require('../shared.cjs');
registerTests(describe, (name, check) => test(name, check, 30000));
