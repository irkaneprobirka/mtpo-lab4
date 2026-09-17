"""Последовательное сравнение раннеров по времени, CPU и памяти дерева процессов.
CPU является нижней оценкой: короткие процессы и последние интервалы могут быть пропущены.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import random
import re
import shutil
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
import psutil

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
COMMANDS = {
    "Jest": ["node_modules/jest/bin/jest.js", "--runInBand", "--ci"],
    "Mocha": ["node_modules/mocha/bin/mocha.js", "tests/mocha/*.test.js"],
    "Vitest": ["node_modules/vitest/vitest.mjs", "run"],
}

def positive(value):
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError("Требуется положительное целое число")
    return n

def measure(node, framework, file, repeats, interval, timeout, log, expected_tests):
    env = dict(os.environ, TEST_INPUT_FILE=str(file), TEST_REPEAT_COUNT=str(repeats),
               CI="1", NO_COLOR="1", FORCE_COLOR="0")
    env.pop("NODE_OPTIONS", None)
    started = time.perf_counter()
    last_cpu, known, peak, samples, max_gap = {}, {}, 0, 0, 0
    previous = started
    with log.open("w", encoding="utf-8") as output:
        child = subprocess.Popen([node, *COMMANDS[framework]], cwd=ROOT, env=env,
                                 stdout=output, stderr=subprocess.STDOUT)
        root = psutil.Process(child.pid)
        known[(root.pid, root.create_time())] = root
        timed_out = False
        while child.poll() is None:
            now = time.perf_counter()
            max_gap = max(max_gap, now - previous)
            previous = now
            try:
                for proc in root.children(recursive=True):
                    known[(proc.pid, proc.create_time())] = proc
            except psutil.NoSuchProcess:
                pass
            rss = 0
            for key, proc in list(known.items()):
                try:
                    # PID вместе со временем создания защищает от повторного использования номера процесса.
                    with proc.oneshot():
                        cpu = proc.cpu_times()
                        last_cpu[key] = max(last_cpu.get(key, 0), cpu.user + cpu.system)
                        rss += proc.memory_info().rss
                except psutil.NoSuchProcess:
                    pass
            peak = max(peak, rss)
            samples += 1
            if now - started > timeout:
                timed_out = True
                for proc in reversed(list(known.values())):
                    try:
                        proc.kill()
                    except psutil.NoSuchProcess:
                        pass
                break
            time.sleep(interval)
        code = child.wait()
    elapsed = time.perf_counter() - started
    cpu = sum(last_cpu.values())
    # Успешный код выхода недостаточен: проверяем число реально пройденных тестов.
    output_text = log.read_text(encoding="utf-8")
    output_text = re.sub(r"\x1b\[[0-9;]*m", "", output_text)
    pattern = r"Tests:\s+(\d+) passed" if framework == "Jest" else (
        r"(\d+) passing" if framework == "Mocha" else r"Tests\s+(\d+) passed")
    match = re.search(pattern, output_text)
    passed_tests = int(match.group(1)) if match else 0
    return dict(framework=framework, exit_code=code, timed_out=timed_out,
                valid=code == 0 and not timed_out and samples >= 2 and peak > 0 and cpu > 0 and passed_tests == expected_tests,
                tests_passed=passed_tests, tests_expected=expected_tests,
                wall_ms=elapsed * 1000, cpu_ms=cpu * 1000,
                cpu_percent=100 * cpu / elapsed, rss_mib=peak / 2**20,
                samples=samples, max_sample_gap_ms=max_gap * 1000, processes=len(known),
                log=os.path.relpath(log, ROOT))

def summarize(rows):
    result = []
    for dataset, framework in sorted({(r["dataset"], r["framework"]) for r in rows}):
        group = [r for r in rows if r["dataset"] == dataset and r["framework"] == framework and r["valid"]]
        if not group:
            continue
        entry = dict(dataset=dataset, framework=framework, runs=len(group))
        for key in ("wall_ms", "cpu_ms", "cpu_percent", "rss_mib"):
            values = [r[key] for r in group]
            q = statistics.quantiles(values, n=4, method="inclusive") if len(values) > 1 else values * 3
            entry[key] = statistics.median(values)
            entry[key + "_q1"], entry[key + "_q3"] = q[0], q[2]
        result.append(entry)
    return result

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", nargs="+", default=["data/size-100.json", "data/size-1000.json", "data/size-10000.json"])
    p.add_argument("--runs", type=positive, default=7)
    p.add_argument("--repeats", type=positive, default=10)
    p.add_argument("--interval-ms", type=positive, default=10)
    p.add_argument("--timeout", type=positive, default=120)
    p.add_argument("--seed", type=int, default=2026)
    p.add_argument("--node", default=shutil.which("node"))
    p.add_argument("--output", default="reports/run-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    a = p.parse_args()
    if not a.node:
        p.error("Node.js не найден; используйте --node")
    out = (ROOT / a.output).resolve()
    if (out / "metadata.json").exists():
        p.error("Каталог уже содержит серию измерений; выберите другое имя --output")
    out.mkdir(parents=True, exist_ok=True)
    (out / "logs").mkdir(exist_ok=True)
    node = str(Path(a.node).resolve())
    files = [(ROOT / f).resolve() for f in a.input]
    # Проверяем данные общей функцией до измерений.
    manifests = {}
    for file in files:
        env = dict(os.environ, TEST_INPUT_FILE=str(file), TEST_REPEAT_COUNT=str(a.repeats))
        listing = subprocess.check_output([node, "scripts/test-manifest.js"], cwd=ROOT, env=env, encoding="utf-8")
        manifests[file.name] = json.loads(listing)
    if len({len(tests) for tests in manifests.values()}) != 1:
        p.error("Входы должны регистрировать одинаковое число тестов для сравнения размеров")
    (out / "tests.json").write_text(json.dumps(manifests, ensure_ascii=False, indent=2), encoding="utf-8")
    metadata = dict(created_local=datetime.now().astimezone().isoformat(), created_utc=datetime.now(timezone.utc).isoformat(), platform=platform.platform(),
        cpu=platform.processor(), logical_cpus=psutil.cpu_count(), physical_cpus=psutil.cpu_count(logical=False),
        ram_gib=psutil.virtual_memory().total / 2**30, python=platform.python_version(), psutil=psutil.__version__,
        node=subprocess.check_output([node, "--version"], text=True).strip(),
        versions={n: json.loads((ROOT / "node_modules" / n / "package.json").read_text(encoding="utf-8"))["version"]
                  for n in ("jest", "mocha", "vitest")},
        options=vars(a), commands=COMMANDS,
        workload="Полный набор тестов, включая настоящие запуски консоли; ничего не исключено",
        test_counts={name: len(tests) for name, tests in manifests.items()},
        source_sha256={str(f.relative_to(ROOT)): hashlib.sha256(f.read_bytes()).hexdigest()
                       for folder in ("src", "tests", "scripts") for f in sorted((ROOT / folder).rglob("*")) if f.is_file()},
        config_sha256={name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                       for name in ("benchmark.py", "jest.config.cjs", "vitest.config.mjs", "package.json")},
        files={f.name: dict(bytes=f.stat().st_size, sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in files},
        lock_sha256=hashlib.sha256((ROOT / "package-lock.json").read_bytes()).hexdigest(),
        cpu_method="Сумма последних наблюдаемых user+system по процессам; нижняя оценка",
        memory_method="Максимум наблюдаемой суммы RSS живых процессов дерева, MiB",
        cache_policy="Один исключённый прогрев на сочетание; новый процесс на запуск; кэши ОС сохраняются")
    (out / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    rng = random.Random(a.seed)
    rows, warmups = [], []
    for file in files:
        for framework in COMMANDS:
            row = measure(node, framework, file, a.repeats, a.interval_ms / 1000, a.timeout,
                          out / "logs" / f"{file.stem}-{framework}-warmup.log", len(manifests[file.name]))
            warmups.append(dict(dataset=file.name, **row))
            if not row["valid"]:
                raise RuntimeError(f"Прогрев завершился ошибкой: {row}")
    (out / "warmups.json").write_text(json.dumps(warmups, indent=2), encoding="utf-8")
    # Каждый раунд содержит все сочетания входа и раннера в случайном порядке.
    for run in range(1, a.runs + 1):
        block = [(f, framework) for f in files for framework in COMMANDS]
        rng.shuffle(block)
        for file, framework in block:
            row = dict(dataset=file.name, run=run, order=len(rows) + 1,
                       **measure(node, framework, file, a.repeats, a.interval_ms / 1000, a.timeout,
                                 out / "logs" / f"{file.stem}-{framework}-{run}.log", len(manifests[file.name])))
            rows.append(row)
            (out / "raw.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
            print(f'{run}/{a.runs} {file.name} {framework}: {row["wall_ms"]:.1f} мс; корректен={row["valid"]}', flush=True)
    (out / "summary.json").write_text(json.dumps(summarize(rows), indent=2), encoding="utf-8")
    if not all(r["valid"] for r in rows):
        raise SystemExit("Есть неуспешные измерения. Проверьте исходные данные и журналы.")

if __name__ == "__main__":
    main()
