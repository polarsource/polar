"""Aggregate loadgen results into a before/after Markdown table (median of repeats)."""

import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

HEADER = (
    "| replica delay | version | primary conns busy (avg / max) "
    "| primary idle in tx (avg) | primary conn-ms per request "
    "| write p50 / p99 (ms) | write errors | read p50 / p99 (ms) | read errors |\n"
    "|---|---|---|---|---|---|---|---|---|\n"
)


def summarize_runs(delay: int, variant: str, runs: list[dict[str, Any]]) -> str:
    def db(key: str) -> float:
        return statistics.median(r["db"][key] for r in runs)

    def stream(name: str, key: str) -> float:
        return statistics.median(r["streams"][name][key] for r in runs)

    def errors(name: str) -> str:
        failed = sum(sum(r["streams"][name]["errors"].values()) for r in runs)
        sent = sum(r["streams"][name]["sent"] for r in runs)
        return f"{failed}/{sent}"

    return (
        f"| {delay} ms | {variant} "
        f"| {db('primary_busy_avg'):.1f} / {db('primary_busy_max'):.0f} "
        f"| {db('primary_idle_in_tx_avg'):.1f} "
        f"| {db('primary_conn_ms_per_request'):.0f} "
        f"| {stream('primary_write', 'p50_ms'):.0f} / "
        f"{stream('primary_write', 'p99_ms'):.0f} "
        f"| {errors('primary_write')} "
        f"| {stream('replica_read', 'p50_ms'):.0f} / "
        f"{stream('replica_read', 'p99_ms'):.0f} "
        f"| {errors('replica_read')} |\n"
    )


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "results.jsonl")
    groups: dict[tuple[int, str], list[dict[str, Any]]] = defaultdict(list)
    for line in path.read_text().splitlines():
        row = json.loads(line)
        variant, delay, _ = row["label"].split("|")
        groups[(int(delay.removeprefix("delay=")), variant)].append(row)

    sys.stdout.write(HEADER)
    for delay in sorted({delay for delay, _ in groups}):
        for variant in ("before", "after"):
            if runs := groups.get((delay, variant)):
                sys.stdout.write(summarize_runs(delay, variant, runs))


main()
