'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Параметры — длины строк. Число примеров фиксировано, чтобы менять один фактор.
const sizes = process.argv.slice(2).map(Number);
if (sizes.length === 0) sizes.push(100, 1000, 10000);
if (sizes.some(size => !Number.isSafeInteger(size) || size < 1 || size > 1000000)) {
  console.error('Размеры должны быть целыми числами от 1 до 1000000');
  process.exit(1);
}
for (const size of sizes) {
  const strings = [];
  for (let index = 0; index < 8; index++) {
    strings.push(index % 2 === 0 ? 'a'.repeat(size) : 'ab'.repeat(Math.ceil(size / 2)).slice(0, size));
  }
  const file = path.join(__dirname, `../data/size-${size}.json`);
  fs.writeFileSync(file, JSON.stringify({ strings }, null, 2));
  console.log('Подготовлен набор:', size, 'символов в строке;', strings.length, 'строк');
}
