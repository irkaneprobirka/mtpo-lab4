const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { spawn } = require('node:child_process');
const pidusage = require('pidusage');
const { runManacherSuite } = require('./run-suite');

const FRAMEWORKS = [
  { name: 'Jest', args: ['node_modules/jest/bin/jest.js', 'tests/jest', '--runInBand'] },
  { name: 'Vitest', args: ['node_modules/vitest/vitest.mjs', 'run', 'tests/vitest', '--pool=threads'] },
  { name: 'Mocha', args: ['node_modules/mocha/bin/mocha.js', 'tests/mocha/**/*.test.js'] }
];

function parseArgs(argv) {
  const args = {
    input: 'data/author-palindromes.json',
    expected: null,
    runs: 3,
    verify: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--expected') args.expected = argv[++i];
    else if (argv[i] === '--runs') args.runs = Number(argv[++i]);
    else if (argv[i] === '--verify') args.verify = true;
  }
  return args;
}

function writeReports(dataset, rows) {
  fs.mkdirSync('reports', { recursive: true });
  const base = `benchmark-results-${dataset.format}`;
  fs.writeFileSync(path.join('reports', `${base}.json`), JSON.stringify(rows, null, 2));

  const header = 'dataset,format,cases,totalInputLength,framework,run,exitCode,timeMs,peakMemoryMb,peakCpuPercent';
  const csvRows = rows.map((row) => [
    row.dataset,
    row.format,
    row.cases,
    row.totalInputLength,
    row.framework,
    row.run,
    row.exitCode,
    row.timeMs,
    row.peakMemoryMb,
    row.peakCpuPercent
  ].join(','));
  fs.writeFileSync(path.join('reports', `${base}.csv`), [header, ...csvRows].join('\n'));
}

async function runFramework(framework, dataset, inputFile, run) {
  const started = performance.now();
  let peakMemoryMb = 0;
  let peakCpuPercent = 0;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, framework.args, {
      stdio: 'ignore',
      env: {
        ...process.env,
        TEST_INPUT_FILE: path.resolve(inputFile),
        TEST_REPEAT_COUNT: '15'
      }
    });

    const sampler = setInterval(async () => {
      try {
        const stats = await pidusage(child.pid);
        peakMemoryMb = Math.max(peakMemoryMb, stats.memory / 1024 / 1024);
        peakCpuPercent = Math.max(peakCpuPercent, stats.cpu);
      } catch {
        // The process may have already exited between two samples.
      }
    }, 50);

    child.on('close', async (exitCode) => {
      clearInterval(sampler);
      try {
        await pidusage.clear(child.pid);
      } catch {
        // Cache cleanup is best-effort.
      }

      resolve({
        dataset: dataset.name,
        format: dataset.format,
        cases: dataset.cases.length,
        totalInputLength: dataset.cases.reduce((sum, item) => sum + item.input.length, 0),
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
  const { dataset, results } = runManacherSuite(args.input, 1);

  if (args.verify) {
    const expected = JSON.parse(fs.readFileSync(args.expected, 'utf8'));
    const actual = results.map((item) => ({
      name: item.name,
      longest: item.longest,
      count: item.count
    }));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Reference verification failed');
    }
    console.log('Reference verification passed');
    return;
  }

  const rows = [];
  for (const framework of FRAMEWORKS) {
    for (let run = 1; run <= args.runs; run += 1) {
      rows.push(await runFramework(framework, dataset, args.input, run));
    }
  }
  writeReports(dataset, rows);
  console.table(rows);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
