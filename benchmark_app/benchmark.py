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
import shutil
import subprocess
import sys
from datetime import datetime, timezone
import psutil

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from measurement.config import ROOT, COMMANDS
from measurement.process import measure
from measurement.summary import summarize

def positive(value):
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError("Требуется положительное целое число")
    return n


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
                       for folder in ("src", "tests", "scripts", "measurement") for f in sorted((ROOT / folder).rglob("*")) if f.is_file() and "__pycache__" not in f.parts},
        config_sha256={name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                       for name in ("benchmark.py", "jest.config.cjs", "vitest.config.mjs", ".mocharc.json", "package.json")},
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
