import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/vitest/*.test.js'], environment: 'node', pool: 'threads', maxWorkers: 1, minWorkers: 1, fileParallelism: false } });
