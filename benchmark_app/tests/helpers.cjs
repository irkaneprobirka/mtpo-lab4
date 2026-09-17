const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Каждый тест получает свой файл. Очистка выполняется даже при ошибке проверки.
function withFile(content, check, extension = '.json') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'manacher-test-'));
  const file = path.join(directory, `input${extension}`);
  try {
    fs.writeFileSync(file, content, 'utf8');
    return check(file);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
}

// Независимый перебор подстрок используется только на коротких входах.
function bruteForce(text) {
  const characters = Array.from(text);
  let longest = '';
  let length = 0;
  let count = 0;
  for (let start = 0; start < characters.length; start++) {
    for (let end = start + 1; end <= characters.length; end++) {
      const part = characters.slice(start, end);
      if (part.join('') === [...part].reverse().join('')) {
        count++;
        if (part.length > length) {
          longest = part.join('');
          length = part.length;
        }
      }
    }
  }
  return { longest, length, count };
}
module.exports = { withFile, bruteForce };
