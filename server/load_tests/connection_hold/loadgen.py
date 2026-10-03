"""Open-loop load generator + Postgres-side connection sampler.

Each stream fires requests on a fixed schedule regardless of how fast the server answers
(no coordinated omission); latency is measured from the scheduled send time.
Every 20 ms it samples pg_stat_activity for the API's connections, split by role:
the primary pool connects as --primary-role, the replica pool as --replica-role.
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import aiohttp
import asyncpg
import uvloop

BASE = "http://127.0.0.1:8100"


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    values = sorted(values)
    return values[min(len(values) - 1, int(p / 100 * len(values)))]


async def run(args: argparse.Namespace, seed: dict[str, str]) -> dict[str, Any]:
    cookie = {"Cookie": f"{seed['cookie_name']}={seed['user_session_cookie']}"}
    bearer = {"Authorization": f"Bearer {seed['organization_token']}"}

    streams = {
        "replica_read": {
            "rate": args.read_rps,
            "method": "GET",
            "path": f"/v1/products/?organization_id={seed['organization_id']}&limit=10",
            "headers": cookie,
        },
        "primary_write": {
            "rate": args.write_rps,
            "method": "POST",
            "path": "/v1/customers/",
            "headers": bearer,
        },
    }
    results: dict[str, list[tuple[float, float, int]]] = {k: [] for k in streams}
    samples: list[dict[str, float]] = []
    stop = asyncio.Event()

    pg = await asyncpg.connect(args.admin_dsn)

    async def sampler() -> None:
        while not stop.is_set():
            rows = await pg.fetch(
                "SELECT usename, state, count(*) AS n FROM pg_stat_activity "
                "WHERE datname = $1 AND application_name = 'development.app' "
                "GROUP BY 1, 2",
                args.database,
            )
            sample: dict[str, float] = {"t": time.monotonic()}
            for row in rows:
                sample[f"{row['usename']}|{row['state']}"] = row["n"]
            samples.append(sample)
            await asyncio.sleep(0.02)

    connector = aiohttp.TCPConnector(limit=0)
    timeout = aiohttp.ClientTimeout(total=90)
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as http:

        async def fire(
            name: str, stream: dict[str, Any], scheduled: float, measured: bool
        ) -> None:
            body = None
            if stream["method"] == "POST":
                body = {"email": f"bench-{uuid.uuid4().hex[:12]}@polar.sh"}
            try:
                async with http.request(
                    stream["method"],
                    BASE + stream["path"],
                    headers=stream["headers"],
                    json=body,
                ) as response:
                    await response.read()
                    status = response.status
            except Exception:
                status = -1
            if measured:
                results[name].append((scheduled, time.monotonic() - scheduled, status))

        async def driver(name: str, stream: dict[str, Any], start: float) -> None:
            if stream["rate"] <= 0:
                return
            interval = 1 / stream["rate"]
            tasks = []
            i = 0
            while True:
                scheduled = start + i * interval
                if scheduled > start + args.warmup + args.duration:
                    break
                delay = scheduled - time.monotonic()
                if delay > 0:
                    await asyncio.sleep(delay)
                tasks.append(
                    asyncio.create_task(
                        fire(name, stream, scheduled, scheduled >= start + args.warmup)
                    )
                )
                i += 1
            await asyncio.gather(*tasks)

        start = time.monotonic() + 0.2
        sampler_task = asyncio.create_task(sampler())
        await asyncio.gather(*(driver(n, s, start) for n, s in streams.items()))
        stop.set()
        await sampler_task
    await pg.close()

    window = [
        s
        for s in samples
        if start + args.warmup <= s["t"] <= start + args.warmup + args.duration
    ]

    def series(key_filter: Callable[[str], bool]) -> list[float]:
        return [
            sum(v for k, v in s.items() if k != "t" and key_filter(k)) for s in window
        ]

    primary, replica = f"{args.primary_role}|", f"{args.replica_role}|"
    primary_busy = series(lambda k: k.startswith(primary) and not k.endswith("|idle"))
    primary_idle_in_tx = series(lambda k: k.startswith(f"{primary}idle in transaction"))
    replica_busy = series(lambda k: k.startswith(replica) and not k.endswith("|idle"))

    report = {
        "label": args.label,
        "read_rps": args.read_rps,
        "write_rps": args.write_rps,
        "duration": args.duration,
        "db": {
            "primary_busy_avg": statistics.fmean(primary_busy) if primary_busy else 0,
            "primary_busy_max": max(primary_busy, default=0),
            "primary_idle_in_tx_avg": statistics.fmean(primary_idle_in_tx)
            if primary_idle_in_tx
            else 0,
            "replica_busy_avg": statistics.fmean(replica_busy) if replica_busy else 0,
            "samples": len(window),
        },
        "streams": {},
    }
    for name, rows in results.items():
        if not rows:
            continue
        ok = [lat for _, lat, status in rows if 200 <= status < 300]
        errors: dict[str, int] = {}
        for _, _, status in rows:
            if not 200 <= status < 300:
                errors[str(status)] = errors.get(str(status), 0) + 1
        report["streams"][name] = {
            "sent": len(rows),
            "ok": len(ok),
            "errors": errors,
            "throughput_rps": len(ok) / args.duration,
            "p50_ms": pct(ok, 50) * 1000,
            "p95_ms": pct(ok, 95) * 1000,
            "p99_ms": pct(ok, 99) * 1000,
            "max_ms": max(ok, default=float("nan")) * 1000,
        }
    # Little's law: average busy primary connections / requests per second
    # = primary connection-seconds held per request.
    total_rps = sum(s["throughput_rps"] for s in report["streams"].values())
    report["db"]["primary_conn_ms_per_request"] = (
        report["db"]["primary_busy_avg"] / total_rps * 1000 if total_rps else 0
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--seed", default="seed.json")
    parser.add_argument("--read-rps", type=float, default=0)
    parser.add_argument("--write-rps", type=float, default=0)
    parser.add_argument("--duration", type=float, default=30)
    parser.add_argument("--warmup", type=float, default=5)
    parser.add_argument("--out", required=True)
    parser.add_argument(
        "--admin-dsn", default="postgresql://polar:polar@127.0.0.1:5432/postgres"
    )
    parser.add_argument("--database", default="polar_bench")
    parser.add_argument("--primary-role", default="polar")
    parser.add_argument("--replica-role", default="polar_read")
    args = parser.parse_args()
    seed = json.loads(Path(args.seed).read_text())
    report = uvloop.run(run(args, seed))
    with Path(args.out).open("a") as f:
        f.write(json.dumps(report) + "\n")
    sys.stdout.write(json.dumps(report, indent=1) + "\n")


main()
