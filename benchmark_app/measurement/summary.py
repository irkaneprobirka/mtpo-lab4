"""Медианы и квартили успешных измерений."""
import statistics

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
