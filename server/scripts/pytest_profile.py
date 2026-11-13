import cProfile
import json
import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

import pytest

worker = os.environ.get("PYTEST_XDIST_WORKER")
directory = Path(os.environ["POLAR_CI_PROFILE_DIRECTORY"])
profiler = cProfile.Profile()
started_at = time.monotonic()
cpu_started_at = time.process_time()
phases = {"setup": 0.0, "call": 0.0, "teardown": 0.0}
test_calls = 0
samples: list[dict[str, Any]] = []
stop_monitor = threading.Event()
monitor_thread: threading.Thread | None = None

ACTIVITY_QUERY = """
SELECT json_build_object(
    'activity', (
        SELECT coalesce(json_agg(activity), '[]'::json)
        FROM (
            SELECT state, wait_event_type, wait_event, count(*) AS connections
            FROM pg_stat_activity
            WHERE datname LIKE 'polar_test%' AND pid <> pg_backend_pid()
            GROUP BY state, wait_event_type, wait_event
        ) AS activity
    ),
    'locks', (SELECT count(*) FROM pg_locks)
)
"""


def monitor_postgres() -> None:
    postgres = os.environ["POLAR_CI_POSTGRES_CONTAINER"]
    tinybird = os.environ["POLAR_CI_TINYBIRD_CONTAINER"]
    while not stop_monitor.wait(2):
        sample: dict[str, Any] = {"elapsed": time.monotonic() - started_at}
        try:
            result = subprocess.run(
                [
                    "docker",
                    "exec",
                    postgres,
                    "psql",
                    "-U",
                    "polar",
                    "-d",
                    "polar_test",
                    "-At",
                    "-c",
                    ACTIVITY_QUERY,
                ],
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
            sample["postgres"] = json.loads(result.stdout)
            result = subprocess.run(
                [
                    "docker",
                    "stats",
                    "--no-stream",
                    "--format",
                    "{{json .}}",
                    postgres,
                    tinybird,
                ],
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
            sample["containers"] = [
                json.loads(line) for line in result.stdout.splitlines()
            ]
        except (subprocess.SubprocessError, json.JSONDecodeError) as error:
            sample["error"] = str(error)
        samples.append(sample)


@pytest.hookimpl(tryfirst=True)
def pytest_load_initial_conftests() -> None:
    if worker:
        profiler.enable()


def pytest_sessionstart() -> None:
    global monitor_thread
    if not worker and os.environ.get("POLAR_CI_POSTGRES_CONTAINER"):
        monitor_thread = threading.Thread(target=monitor_postgres, daemon=True)
        monitor_thread.start()


def pytest_runtest_logreport(report: pytest.TestReport) -> None:
    global test_calls
    if worker:
        phases[report.when] += report.duration
        test_calls += report.when == "call"


def pytest_sessionfinish() -> None:
    directory.mkdir(parents=True, exist_ok=True)
    if worker:
        profiler.disable()
        profiler.dump_stats(directory / f"{worker}.prof")
        (directory / f"{worker}.json").write_text(
            json.dumps(
                {
                    "wall_seconds": time.monotonic() - started_at,
                    "cpu_seconds": time.process_time() - cpu_started_at,
                    "phases": phases,
                    "test_calls": test_calls,
                }
            )
        )
    else:
        stop_monitor.set()
        if monitor_thread:
            monitor_thread.join(timeout=15)
        (directory / "postgres.json").write_text(json.dumps(samples))
