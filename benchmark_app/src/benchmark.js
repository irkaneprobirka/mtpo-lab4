import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { buildValues, summarize } from './summary.js';

const frameworks = [
  { name: 'Jest', script: 'test:jest' },
  { name: 'Vitest', script: 'test:vitest' },
  { name: 'Mocha', script: 'test:mocha' }
];

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(fileName, 'utf8'));
}

function equalResult(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function parseArgs(argv) {
  const args = { input: 'data/author_example.json', expected: null, runs: 1, verify: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--expected') args.expected = argv[++i];
    else if (argv[i] === '--runs') args.runs = Number(argv[++i]);
    else if (argv[i] === '--verify') args.verify = true;
  }
  return args;
}

async function runCommand(framework) {
  const started = performance.now();
  let peakRssMb = 0;
  let peakCpuPercent = 0;
  const npmCommand = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const npmArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd', 'run', framework.script]
    : ['run', framework.script];

  return new Promise((resolve) => {
    const child = spawn(npmCommand, npmArgs, { stdio: 'ignore' });
    const timer = setInterval(() => {
      // RSS is read for the parent process as a portable approximation.
      peakRssMb = Math.max(peakRssMb, process.memoryUsage().rss / 1024 / 1024);
      const cpu = process.cpuUsage();
      peakCpuPercent = Math.max(peakCpuPercent, (cpu.user + cpu.system) / 10000);
    }, 25);

    child.on('close', (code) => {
      clearInterval(timer);
      resolve({
        framework: framework.name,
        exitCode: code,
        timeMs: Number((performance.now() - started).toFixed(3)),
        peakRssMb: Number(peakRssMb.toFixed(3)),
        peakCpuPercent: Number(peakCpuPercent.toFixed(3))
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const dataset = readJson(args.input);
  const values = buildValues(dataset);
  const actual = summarize(values);

  if (args.verify) {
    const expected = readJson(args.expected);
    if (!equalResult(actual, expected)) {
      throw new Error('Reference output does not match calculated result');
    }
    console.log('Reference verification passed');
    return;
  }

  const results = [];
  for (const framework of frameworks) {
    for (let run = 1; run <= args.runs; run += 1) {
      results.push({ dataset: dataset.name, size: values.length, run, ...(await runCommand(framework)) });
    }
  }

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(path.join('reports', 'benchmark-results.json'), JSON.stringify(results, null, 2));
  const header = 'dataset,size,run,framework,exitCode,timeMs,peakRssMb,peakCpuPercent';
  const rows = results.map((item) => [
    item.dataset,
    item.size,
    item.run,
    item.framework,
    item.exitCode,
    item.timeMs,
    item.peakRssMb,
    item.peakCpuPercent
  ].join(','));
  fs.writeFileSync(path.join('reports', 'benchmark-results.csv'), [header, ...rows].join('\n'));
  console.table(results);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
