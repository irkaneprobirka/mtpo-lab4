Эталон: LeetCode, задача 5 «Longest Palindromic Substring»: https://leetcode.com/problems/longest-palindromic-substring/description/ (проверено 16.09.2026).

Входы babad и cbbd, максимальные палиндромы bab (или aba) и bb взяты из условия. Реализация выбирает левый максимум bab. Числа вхождений 7 и 5 рассчитаны автором, не приписываются источнику. Вход и ответ находятся в отдельных файлах reference-input.json и reference-output.json.

example.json — авторский пример. Нагрузочные файлы создаёт scripts/generate.js; ожидания вычисляются в tests/workload.cjs по формулам для однородных и чередующихся строк, без вызова Манакера.
