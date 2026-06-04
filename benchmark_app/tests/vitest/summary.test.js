import { describe, expect, it } from 'vitest';
import { buildValues, summarize } from '../../src/summary.js';

describe('summary', () => {
  it('calculates summary for reference input', () => {
    const values = buildValues({ size: 5, values: [9, 1, 5, 3, 7] });
    expect(summarize(values)).toEqual({
      sorted: [1, 3, 5, 7, 9],
      sum: 25,
      mean: 5,
      min: 1,
      max: 9
    });
  });
});
