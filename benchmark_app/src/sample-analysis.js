function percentile(sorted, p) {
  if (sorted.length === 0) {
    return 0;
  }
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function isPrime(value) {
  if (value < 2) {
    return false;
  }
  for (let divider = 2; divider * divider <= value; divider += 1) {
    if (value % divider === 0) {
      return false;
    }
  }
  return true;
}

function analyzeSample(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);
  const mean = values.length === 0 ? 0 : sum / values.length;
  const primeCount = values.filter(isPrime).length;

  return {
    count: values.length,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    sum,
    mean,
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    uniqueCount: new Set(values).size,
    primeCount
  };
}

module.exports = { analyzeSample, isPrime, percentile };
