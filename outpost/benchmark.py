import argparse
import asyncio
import json
import math
import multiprocessing
import multiprocessing.synchronize
import os
import statistics
from concurrent.futures import ProcessPoolExecutor
from time import perf_counter
from uuid import uuid4

import httpx2

from outpost.env import get_environment
from outpost.redis import create_redis

start_barrier: multiprocessing.synchronize.Barrier | None = None


def initialize_worker(barrier: multiprocessing.synchronize.Barrier) -> None:
    global start_barrier
    start_barrier = barrier


def run_benchmark(args: argparse.Namespace) -> tuple[list[float], float, float]:
    try:
        return asyncio.run(benchmark(args))
    except BaseException:
        if start_barrier is not None:
            start_barrier.abort()
        raise


def positive_int(value: str) -> int:
    number = int(value)
    if number <= 0:
        message = "Must be greater than zero"
        raise argparse.ArgumentTypeError(message)
    return number


async def benchmark(args: argparse.Namespace) -> tuple[list[float], float, float]:
    prefix = f"benchmark-{uuid4()}"
    customers = [f"{prefix}-{i}" for i in range(min(args.customers, args.batch_size))]
    body = json.dumps(
        {
            "events": [
                {
                    "timestamp": "2026-01-01T00:00:00Z",
                    "name": "tool_call",
                    "external_customer_id": customers[i % len(customers)],
                    "metadata": {"tokens": 100, "model": "benchmark"},
                }
                for i in range(args.batch_size)
            ]
        }
    ).encode()
    samples: list[float] = []

    async with (
        create_redis(args.redis_url) as redis,
        httpx2.AsyncClient(
            timeout=30,
            limits=httpx2.Limits(
                max_connections=args.concurrency,
                max_keepalive_connections=args.concurrency,
            ),
        ) as client,
    ):

        async def ingest(record: bool) -> None:
            start = perf_counter()
            response = await client.post(
                f"{args.url.rstrip('/')}/ingest",
                content=body,
                headers={"Content-Type": "application/json"},
            )
            if response.status_code != 202:
                message = f"Ingest returned {response.status_code}: {response.text}"
                raise RuntimeError(message)
            if record:
                samples.append(perf_counter() - start)

        requests = iter(range(args.requests))

        async def worker() -> None:
            for _ in requests:
                await ingest(record=True)

        try:
            for _ in range(args.warmup):
                await ingest(record=False)
            if start_barrier is not None:
                await asyncio.to_thread(start_barrier.wait)
            start = perf_counter()
            async with asyncio.TaskGroup() as group:
                for _ in range(args.concurrency):
                    group.create_task(worker())
            end = perf_counter()

            batch_counts = [0] * len(customers)
            for i in range(args.batch_size):
                batch_counts[i % len(customers)] += 1
            for customer, count in zip(customers, batch_counts, strict=True):
                stored = await redis.hget(f"outpost:meters:{customer}", "METER_1")
                expected = count * (args.requests + args.warmup)
                if stored is None or int(stored) != expected:
                    message = (
                        f"Redis count mismatch: expected {expected}, got {stored!r}. "
                        "--redis-url must match the server's Redis."
                    )
                    raise RuntimeError(message)
        finally:
            await redis.delete(
                *(f"outpost:meters:{customer}" for customer in customers)
            )

    return samples, start, end


def report(
    args: argparse.Namespace,
    results: list[tuple[list[float], float, float]],
) -> None:
    samples = [sample for durations, _, _ in results for sample in durations]
    if len(samples) != args.requests:
        message = f"Expected {args.requests} requests, got {len(samples)}"
        raise RuntimeError(message)
    elapsed = max(end for _, _, end in results) - min(start for _, start, _ in results)
    print("HTTP /ingest; count meter matching tool_call events")
    print(
        f"{args.requests:,} requests × {args.batch_size:,} events; "
        f"concurrency={args.concurrency}; processes={len(results)}; "
        f"customers/batch={min(args.customers, args.batch_size)}; "
        f"warmup={args.warmup} (excluded)"
    )
    print(
        f"{elapsed:.3f}s; {args.requests / elapsed:,.0f} requests/s; "
        f"{args.requests * args.batch_size / elapsed:,.0f} events/s"
    )
    print(
        f"{'Stage (ms/request)':<22} {'mean':>10} {'p50':>10} {'p95':>10} {'p99':>10}"
    )
    ordered = sorted(duration * 1000 for duration in samples)
    percentiles = [ordered[math.ceil(len(ordered) * p) - 1] for p in (0.5, 0.95, 0.99)]
    print(
        f"{'ingest':<22} {statistics.mean(ordered):10.3f} "
        + " ".join(f"{value:10.3f}" for value in percentiles)
    )
    print("Redis counts verified; benchmark keys removed.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Outpost HTTP ingestion")
    parser.add_argument("--requests", type=positive_int, default=1000)
    parser.add_argument("--batch-size", type=positive_int, default=100)
    parser.add_argument("--concurrency", type=positive_int, default=1)
    parser.add_argument(
        "--processes",
        type=positive_int,
        default=min(4, os.process_cpu_count() or 1),
        help="Maximum client processes (default: up to 4 available CPUs)",
    )
    parser.add_argument("--customers", type=positive_int, default=100)
    parser.add_argument("--warmup", type=positive_int, default=10)
    parser.add_argument("--redis-url", default=str(get_environment().redis_dsn))
    parser.add_argument(
        "--url", default="http://127.0.0.1:9000", help="Running Outpost base URL"
    )
    args = parser.parse_args()
    processes = min(args.processes, args.concurrency, args.requests)
    if processes == 1:
        report(args, [run_benchmark(args)])
        return

    context = multiprocessing.get_context("spawn")
    barrier = context.Barrier(processes, timeout=30)
    with ProcessPoolExecutor(
        max_workers=processes,
        mp_context=context,
        initializer=initialize_worker,
        initargs=(barrier,),
    ) as executor:
        futures = []
        for index in range(processes):
            worker_args = argparse.Namespace(**vars(args))
            for field in ("requests", "concurrency", "warmup"):
                total = getattr(args, field)
                share, remainder = divmod(total, processes)
                setattr(worker_args, field, share + (index < remainder))
            futures.append(executor.submit(run_benchmark, worker_args))
        results = [future.result() for future in futures]
    report(args, results)


if __name__ == "__main__":
    main()
