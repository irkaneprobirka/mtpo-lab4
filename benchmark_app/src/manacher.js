function transformString(input) {
  return `^#${[...input].join('#')}#$`;
}

function manacher(input) {
  const source = String(input ?? '');
  if (source.length === 0) {
    return { radii: [], longest: '', count: 0, transformed: '^#$' };
  }

  const transformed = transformString(source);
  const radii = new Array(transformed.length).fill(0);
  let center = 0;
  let right = 0;

  for (let i = 1; i < transformed.length - 1; i += 1) {
    const mirror = 2 * center - i;
    if (i < right) {
      radii[i] = Math.min(right - i, radii[mirror]);
    }

    while (transformed[i + radii[i] + 1] === transformed[i - radii[i] - 1]) {
      radii[i] += 1;
    }

    if (i + radii[i] > right) {
      center = i;
      right = i + radii[i];
    }
  }

  let maxRadius = 0;
  let maxCenter = 0;
  let count = 0;
  for (let i = 1; i < radii.length - 1; i += 1) {
    if (radii[i] > maxRadius) {
      maxRadius = radii[i];
      maxCenter = i;
    }
    count += Math.floor((radii[i] + 1) / 2);
  }

  const start = Math.floor((maxCenter - maxRadius) / 2);
  return {
    radii,
    longest: source.slice(start, start + maxRadius),
    count,
    transformed
  };
}

module.exports = { manacher, transformString };
