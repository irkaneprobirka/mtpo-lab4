// УЧЕБНЫЙ ДЕФЕКТ. Ошибка: при равенстве длин выбирается правый ответ.
'use strict';

/** Находит левый максимальный палиндром и считает все палиндромные вхождения. */
function manacher(text) {
  if (typeof text !== 'string') {
    throw new TypeError('Вход должен быть строкой');
  }

  // Array.from считает эмодзи одной кодовой точкой, а не двумя частями UTF-16.
  const characters = Array.from(text);
  const separator = Symbol('Разделитель');
  const transformed = [Symbol('Левая граница'), separator];
  for (const character of characters) {
    transformed.push(character, separator);
  }
  transformed.push(Symbol('Правая граница'));

  // Границы и разделитель не совпадут ни с одним пользовательским символом.
  const radii = new Array(transformed.length).fill(0);
  let center = 0;
  let right = 0;
  let longestLength = 0;
  let longestStart = 0;
  let count = 0;

  for (let position = 1; position < transformed.length - 1; position++) {
    // В известной области сначала используем симметричный радиус.
    if (position < right) {
      const mirror = 2 * center - position;
      radii[position] = Math.min(right - position, radii[mirror]);
    }

    // Затем проверяем символы, о которых ещё ничего не известно.
    while (transformed[position - radii[position] - 1] ===
           transformed[position + radii[position] + 1]) {
      radii[position]++;
    }

    if (position + radii[position] > right) {
      center = position;
      right = position + radii[position];
    }

    // Намеренный дефект: равенство тоже обновляет ответ.
    if (radii[position] >= longestLength) {
      longestLength = radii[position];
      longestStart = Math.floor((position - longestLength) / 2);
    }
    count += Math.floor((radii[position] + 1) / 2);
  }

  return {
    longest: characters.slice(longestStart, longestStart + longestLength).join(''),
    length: longestLength,
    count,
  };
}

module.exports = { manacher };
