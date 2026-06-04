const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { spawn } = require('node:child_process');
const pidusage = require('pidusage');
const { loadDataset } = require('./data-loader');
const { analyzeSample } = require('./sample-analysis');

const FRAMEWORKS = [
  { name: 'Jest', args: ['node_modules/jest/bin/jest.js', 'tests/jest', '--runInBand'] },
  { name: 'Vitest', args: ['node_modules/vitest/vitest.mjs', 'run', 'tests/vitest', '--pool=threads'] },
  { name: 'Mocha', args: ['node_modules/mocha/bin/mocha.js', 'tests/mocha/**/*.test.js'] }
];

function parseArgs(argv) {
  const args = {
    input: 'data/author-example.json',
    expected: null,
    runs: 1,
    verify: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[++i];
    if (argv[i] === '--expected') args.expected = argv[++i];
    if (argv[i] === '--runs') args.runs = Number(argv[++i]);
    if (argv[i] === '--verify') args.verify = true;
  }
  return args;
}

function closeEnough(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function writeReports(dataset, results) {
  fs.mkdirSync('reports', { recursive: true });
  const baseName = `benchmark-results-${dataset.source}`;
  fs.writeFileSync(path.join('reports', `${baseName}.json`), JSON.stringify(results, null, 2));

  const header = 'dataset,source,size,framework,run,exitCode,timeMs,peakMemoryMb,peakCpuPercent';
  const rows = results.map((row) => [
    row.dataset,
    row.source,
    row.size,
    row.framework,
    row.run,
    row.exitCode,
    row.timeMs,
    row.peakMemoryMb,
    row.peakCpuPercent
  ].join(','));
  fs.writeFileSync(path.join('reports', `${baseName}.csv`), [header, ...rows].join('\n'));
}

async function runFramework(framework, dataset, run) {
  const started = performance.now();
  let peakMemoryMb = 0;
  let peakCpuPercent = 0;

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      framework.args,
      {
        stdio: 'ignore',
        env: {
          ...process.env,
          TEST_INPUT_FILE: path.resolve(dataset.filePath),
          TEST_REPEAT_COUNT: '25'
        }
      }
    );

    const sampler = setInterval(async () => {
      try {
        const stat = await pidusage(child.pid);
        peakMemoryMb = Math.max(peakMemoryMb, stat.memory / 1024 / 1024);
        peakCpuPercent = Math.max(peakCpuPercent, stat.cpu);
      } catch {
        // The process may exit between interval ticks; the close handler records the run.
      }
    }, 50);

    child.on('close', async (exitCode) => {
      clearInterval(sampler);
      try {
        await pidusage.clear(child.pid);
      } catch {
        // pidusage cache cleanup is best-effort.
      }
      resolve({
        dataset: dataset.name,
        source: dataset.source,
        size: dataset.size,
        framework: framework.name,
        run,
        exitCode,
        timeMs: Number((performance.now() - started).toFixed(3)),
        peakMemoryMb: Number(peakMemoryMb.toFixed(3)),
        peakCpuPercent: Number(peakCpuPercent.toFixed(3))
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const dataset = loadDataset(args.input);
  dataset.filePath = args.input;

  if (args.verify) {
    const expected = JSON.parse(fs.readFileSync(args.expected, 'utf8'));
    const actual = analyzeSample(dataset.values);
    if (!closeEnough(actual, expected)) {
      throw new Error('Reference verification failed');
    }
    console.log('Reference verification passed');
    return;
  }

  const results = [];
  for (const framework of FRAMEWORKS) {
    for (let run = 1; run <= args.runs; run += 1) {
      results.push(await runFramework(framework, dataset, run));
    }
  }
  writeReports(dataset, results);
  console.table(results);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
