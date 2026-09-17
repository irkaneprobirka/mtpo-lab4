"""Измерение одного запуска и проверка его результата."""
import os
import re
import subprocess
import time
import psutil
from .config import ROOT, COMMANDS

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
