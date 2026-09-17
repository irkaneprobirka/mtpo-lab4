"""Проверяет серию и формирует таблицы, графики и выводы без ручного ввода чисел."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import statistics
import sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "benchmark_app"
OUT = ROOT / "report"
sys.path.insert(0, str(APP))
from measurement.summary import summarize

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--series", default="readable-2026-09-17")
args = parser.parse_args()
directory = APP / "reports" / args.series

def read(name):
    return json.loads((directory / name).read_text(encoding="utf-8"))

raw, summary, meta = read("raw.json"), read("summary.json"), read("metadata.json")
assert len(raw) == 63, "Нужны 63 измерения стандартного плана"
assert all(row["valid"] and row["tests_passed"] == 99 for row in raw)
assert len(summary) == 9 and all(row["runs"] == 7 for row in summary)
assert summarize(raw) == summary, "Сводка должна совпадать с исходными измерениями"
for group in ("source_sha256", "config_sha256"):
    for name, digest in meta[group].items():
        assert hashlib.sha256((APP / name).read_bytes()).hexdigest() == digest, name
for name, info in meta["files"].items():
    assert hashlib.sha256((APP / "data" / name).read_bytes()).hexdigest() == info["sha256"]
assert hashlib.sha256((APP / "package-lock.json").read_bytes()).hexdigest() == meta["lock_sha256"]
mutations = json.loads((APP / "reports/mutations/results.json").read_text(encoding="utf-8"))
assert len(mutations) == 9 and all(row["detected"] for row in mutations)

sizes = [100, 1000, 10000]
frameworks = ["Jest", "Mocha", "Vitest"]
lookup = {(row["dataset"], row["framework"]): row for row in summary}
def value(size, framework, metric):
    return lookup[(f"size-{size}.json", framework)][metric]
def write(name, text):
    (OUT / name).write_text(text + "\n", encoding="utf-8")

def table(metric, unit, caption):
    lines = [r"\begin{table}[H]\centering\small", r"\caption{" + caption + "}",
             r"\begin{tabular}{rlrrr}\toprule", "Длина & Раннер & Медиана, " + unit + r" & $Q_1$ & $Q_3$\\\midrule"]
    for size in sizes:
        for framework in frameworks:
            numbers = [value(size, framework, key) for key in (metric, metric + "_q1", metric + "_q3")]
            lines.append(f'{size} & {framework} & ' + ' & '.join(f'{number:.1f}' for number in numbers) + r'\\')
    return "\n".join(lines + [r"\bottomrule\end{tabular}\end{table}"])

metrics = [("wall_ms", "мс", "Полное время запуска", "time"),
           ("cpu_ms", "мс", "Накопленное CPU-время, нижняя оценка", "cpu"),
           ("rss_mib", "MiB", "Наблюдаемый пик суммы RSS", "memory")]
parts = []
for metric, unit, caption, filename in metrics:
    parts.append(table(metric, unit, caption))
    fig, ax = plt.subplots(figsize=(8, 4.3), constrained_layout=True)
    for framework, color in zip(frameworks, ["#a72e48", "#876044", "#287d60"]):
        medians = [value(size, framework, metric) for size in sizes]
        lower = [value(size, framework, metric) - value(size, framework, metric + "_q1") for size in sizes]
        upper = [value(size, framework, metric + "_q3") - value(size, framework, metric) for size in sizes]
        ax.errorbar(sizes, medians, yerr=[lower, upper], label=framework,
                    color=color, marker="o", capsize=4, linewidth=2)
    ax.set_xscale("log")
    ax.set_xticks(sizes, [str(size) for size in sizes])
    ax.set_xlabel("Длина нагрузочной строки, кодовые точки")
    ax.set_ylabel(caption + ", " + unit)
    ax.set_ylim(bottom=0)
    ax.grid(alpha=.2)
    ax.legend(frameon=False)
    fig.savefig(OUT / f"{filename}.pdf")
    plt.close(fig)
    data = ["n Jest Mocha Vitest"]
    for size in sizes:
        data.append(str(size) + " " + " ".join(f'{value(size, framework, metric):.3f}' for framework in frameworks))
    write(filename + ".dat", "\n".join(data))
for metric, unit, caption, filename in metrics:
    parts.append(r"\begin{figure}[H]\centering\includegraphics[width=.94\linewidth]{report/" + filename +
                 r".pdf}\caption{" + caption + r". Точки -- медианы, отрезки -- первый и третий квартили.}\end{figure}")
parts.append(table("cpu_percent", r"\%", "Средняя CPU-загрузка в единицах одного логического процессора"))
parts.append(f'В каждом запуске пройдены 99 тестов. Минимальное число отсчётов равно {min(r["samples"] for r in raw)}; '
             f'максимальный интервал между обходами -- {max(r["max_sample_gap_ms"] for r in raw):.1f} мс. '
             f'Обнаружено от {min(r["processes"] for r in raw)} до {max(r["processes"] for r in raw)} процессов на запуск. '
             'Различие числа обнаруженных процессов также может отражать пропуск коротких процессов при опросе.')
write("generated-results.tex", "\n\n".join(parts))

ranks = {framework: [] for framework in frameworks}
for size in sizes:
    for metric, *_ in metrics:
        for framework in frameworks:
            rank = 1 + sum(value(size, other, metric) < value(size, framework, metric) for other in frameworks)
            ranks[framework].append(rank)
order = sorted(frameworks, key=lambda framework: (statistics.mean(ranks[framework]), value(10000, framework, "wall_ms")))
winner = order[0]
ranking = [r"\begin{table}[H]\centering\caption{Рейтинг по девяти сравнениям медиан}",
           r"\begin{tabular}{lrr}\toprule Раннер & Среднее место & Первых мест из 9\\\midrule"]
for framework in order:
    ranking.append(f'{framework} & {statistics.mean(ranks[framework]):.2f} & {ranks[framework].count(1)}' + r'\\')
ranking += [r"\bottomrule\end{tabular}\end{table}"]
write("ranking.tex", "\n".join(ranking))
text = f'По принятому правилу для исследуемого приложения выбран {winner}. '
text += f'Он получил {ranks[winner].count(1)} первых мест из девяти сравнений. '
text += 'При длине нагрузочной строки 10000 его медианы составили: '
text += f'{value(10000,winner,"wall_ms"):.1f} мс полного времени, {value(10000,winner,"cpu_ms"):.1f} мс CPU-времени '
text += f'и {value(10000,winner,"rss_mib"):.1f} MiB наблюдаемого пика RSS. '
text += 'Выбор относится к полному набору из 99 тестов на данной машине; он не устанавливает универсального победителя для всех проектов.'
write("result-conclusion.tex", text)
write("slide-choice.tex", r"\textbf{Выбор: " + winner + r".} Первых мест: " + str(ranks[winner].count(1)) + " из 9.\\par\n" +
      r"\vspace{3mm}Полный набор: 99 тестов. Рейтинг учитывает время, CPU-время и RSS с равными весами.\par" +
      r"\vspace{3mm}Вывод ограничен данным приложением, конфигурациями и машиной.")
lines = [r"\begin{tabular}{lrrr}\toprule Раннер & Время, мс & CPU, мс & RSS, MiB\\\midrule"]
for framework in frameworks:
    lines.append(framework + ' & ' + ' & '.join(f'{value(10000,framework,metric):.1f}' for metric,*_ in metrics) + r'\\')
write("slide-table.tex", "\n".join(lines + [r"\bottomrule\end{tabular}"]))
date = datetime.fromisoformat(meta["created_local"]).strftime("%d.%m.%Y")
write("environment.tex", f'Серия выполнена {date}. ОС Windows 11; Node.js {meta["node"]}; Python {meta["python"]}; psutil {meta["psutil"]}. '
      f'Компьютер имеет {meta["physical_cpus"]} физических ядер, {meta["logical_cpus"]} логических процессоров и {meta["ram_gib"]:.2f} GiB ОЗУ. '
      'Версии раннеров: ' + ', '.join(f'{name} {meta["versions"][name.lower()]}' for name in frameworks) + '.\n\n' +
      'Успешно завершены 63 измерения и 9 прогревов. Во всех запусках пройдены 99 тестов. '
      'Каждый из трёх контрольных дефектов обнаружен каждым раннером: девять из девяти ожидаемых отказов подтверждены журналами.')
write("slide-environment.tex", f'Windows 11, Node.js {meta["node"]}, {meta["physical_cpus"]} ядер / {meta["logical_cpus"]} потоков, {meta["ram_gib"]:.2f} GiB ОЗУ.')
write("result-summary.md", text)
print("Проверены 63 измерения, хеши и контрольные дефекты. Выбран:", winner)

