import { describe, test } from 'vitest';
import { createRequire } from 'node:module';
// Vitest использует ESM; сами проверки общие для всех трёх раннеров.
const { registerTests } = createRequire(import.meta.url)('../shared.cjs');
registerTests(describe, (name, check) => test(name, check, 30000));
