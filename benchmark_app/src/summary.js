export function buildValues(dataset) {
  const values = [...dataset.values];
  // Deterministic extension keeps large inputs reproducible and compact in git.
  for (let i = values.length; i < dataset.size; i += 1) {
    values.push((i * 37 + 11) % 1000);
  }
  return values.slice(0, dataset.size);
}

export function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, item) => acc + item, 0);
  return {
    sorted,
    sum,
    mean: sum / values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}
