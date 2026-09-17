"""Проверяем чувствительность тестов на трёх намеренных дефектах в изолированных копиях."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from measurement.config import ROOT, COMMANDS

MUTATIONS = [
    ("Правый максимум вместо левого", "src/manacher.js", "rightmost.js", "Левый максимум из эталона"),
    ("Лишнее вхождение на каждом центре", "src/manacher.js", "extra-count.js", "Чётная длина"),
    ("Потеря пробелов при чтении JSON", "src/json-input.js", "trim-input.js", "Пробелы сохраняются"),
]

def main():
    node = shutil.which("node")
    if not node:
        raise SystemExit("Node.js не найден")
    output = ROOT / "reports" / "mutations"
    output.mkdir(parents=True, exist_ok=True)
    records = []
    # Копии внутри проекта находят установленные пакеты в родительском node_modules.
    # Исходные модули проекта не изменяются.
    for index, (name, source, example, expected_test) in enumerate(MUTATIONS):
        with tempfile.TemporaryDirectory(prefix=".mutation-", dir=ROOT) as directory:
            work = Path(directory)
            for folder in ("src", "tests", "data"):
                shutil.copytree(ROOT / folder, work / folder)
            for file in ("package.json", "jest.config.cjs", "vitest.config.mjs", ".mocharc.json"):
                shutil.copy2(ROOT / file, work / file)
            shutil.copy2(ROOT / "mutations" / example, work / source)
            for framework, command in COMMANDS.items():
                env = dict(os.environ, CI="1", NO_COLOR="1", FORCE_COLOR="0", TEST_REPEAT_COUNT="1")
                env.pop("TEST_INPUT_FILE", None)
                env.pop("NODE_OPTIONS", None)
                args = [node, str(ROOT / command[0]), *command[1:]]
                result = subprocess.run(args, cwd=work, env=env, capture_output=True,
                                        encoding="utf-8", timeout=120)
                log = result.stdout + result.stderr
                (output / f"{index + 1}-{framework}.log").write_text(log, encoding="utf-8")
                detected = result.returncode != 0 and expected_test in log and ("AssertionError" in log or "assert.deepStrictEqual(received, expected)" in log)
                records.append(dict(mutation=name, framework=framework, detected=detected,
                                    exit_code=result.returncode, expected_test=expected_test))
                print(name, framework, "обнаружен" if detected else "НЕ обнаружен", flush=True)
    (output / "results.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    if not all(record["detected"] for record in records):
        raise SystemExit("Не все контрольные дефекты обнаружены")

if __name__ == "__main__":
    main()
