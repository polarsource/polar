# ruff: noqa: E402
from time import perf_counter, process_time

# Freezegun replaces module attributes, but cannot replace these saved clock refs.
_CLOCKS = (perf_counter, process_time)
_START = (_CLOCKS[0](), _CLOCKS[1]())

import hashlib
import json
import os
import sys
from collections.abc import Iterator
from pathlib import Path

_BEFORE_PYTEST = (_CLOCKS[0](), _CLOCKS[1]())
import pytest

_AFTER_PYTEST = (_CLOCKS[0](), _CLOCKS[1]())


class StartupProbe:
    def __init__(self) -> None:
        self.timestamps = {
            "bootstrap_started": self.elapsed(_START),
            "pytest_import_started": self.elapsed(_BEFORE_PYTEST),
            "pytest_import_finished": self.elapsed(_AFTER_PYTEST),
        }
        self.files: dict[str, dict[str, str]] = {}
        self.nodes: list[dict[str, object]] = []
        self.outcomes: dict[str, dict[str, dict[str, object]]] = {}
        self.high_scope_fixtures: dict[str, int] = {}
        self.fixture_intervals: list[dict[str, object]] = []

    def elapsed(self, clocks: tuple[float, float]) -> dict[str, float]:
        return {
            "monotonic_seconds": clocks[0] - _START[0],
            "cpu_seconds": clocks[1] - _START[1],
        }

    def stamp(self, name: str) -> None:
        self.timestamps[name] = self.elapsed((_CLOCKS[0](), _CLOCKS[1]()))

    @pytest.hookimpl(hookwrapper=True, tryfirst=True)
    def pytest_load_initial_conftests(self) -> Iterator[None]:
        self.stamp("initial_conftests_started")
        try:
            yield
        finally:
            self.stamp("initial_conftests_finished")

    @pytest.hookimpl(tryfirst=True)
    def pytest_configure(self, config: pytest.Config) -> None:
        self.stamp("configure_started")
        if getattr(config.option, "numprocesses", None) not in (None, 0):
            raise pytest.UsageError(
                "Startup probe requires direct serial pytest (-n 0)"
            )

    @pytest.hookimpl(hookwrapper=True, tryfirst=True)
    def pytest_sessionstart(self, session: pytest.Session) -> Iterator[None]:
        self.stamp("session_start_started")
        try:
            yield
        finally:
            self.stamp("session_start_finished")

    @pytest.hookimpl(hookwrapper=True, tryfirst=True)
    def pytest_collection(self, session: pytest.Session) -> Iterator[None]:
        self.stamp("collection_started")
        try:
            yield
        finally:
            self.stamp("collection_finished")

    @pytest.hookimpl(trylast=True)
    def pytest_collection_finish(self, session: pytest.Session) -> None:
        self.stamp("collection_finish_hook")
        for item in session.items:
            path = Path(item.path)
            relative = os.path.relpath(path, session.config.rootpath)
            if relative not in self.files:
                self.files[relative] = {
                    "absolute_path": str(path),
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                }
            self.nodes.append(
                {
                    "nodeid": item.nodeid,
                    "file": relative,
                    "xdist_groups": sorted(
                        {
                            str(
                                marker.args[0]
                                if marker.args
                                else marker.kwargs.get("name", "default")
                            )
                            for marker in item.iter_markers("xdist_group")
                        }
                    ),
                }
            )

    @pytest.hookimpl(hookwrapper=True, tryfirst=True)
    def pytest_runtestloop(self, session: pytest.Session) -> Iterator[None]:
        self.stamp("execution_started")
        try:
            yield
        finally:
            self.stamp("execution_finished")

    @pytest.hookimpl(hookwrapper=True, tryfirst=True)
    def pytest_fixture_setup(
        self, fixturedef: pytest.FixtureDef, request: pytest.FixtureRequest
    ) -> Iterator[None]:
        measured = fixturedef.argname in {
            "tinybird_workspace", "initialize_test_database", "tinybird_clickhouse_token",
            "tinybird_client", "metrics_harness", "metrics_module_database_url",
            "tinybird_metrics_database_url",
        }
        before = (_CLOCKS[0](), _CLOCKS[1]()) if measured else None
        try:
            yield
        finally:
            if fixturedef.scope != "function":
                key = f"{fixturedef.baseid}::{fixturedef.argname}[{fixturedef.scope}]"
                self.high_scope_fixtures[key] = self.high_scope_fixtures.get(key, 0) + 1
            if before is not None:
                self.fixture_intervals.append({
                    "fixture": fixturedef.argname, "scope": fixturedef.scope,
                    "node": request.node.nodeid,
                    "started": before[0] - _START[0],
                    "seconds": _CLOCKS[0]() - before[0],
                    "cpu_seconds": _CLOCKS[1]() - before[1],
                })

    def pytest_runtest_logreport(self, report: pytest.TestReport) -> None:
        result: dict[str, object] = {
            "outcome": report.outcome,
            "duration": report.duration,
        }
        if hasattr(report, "wasxfail"):
            result["wasxfail"] = report.wasxfail
        self.outcomes.setdefault(report.nodeid, {})[report.when] = result

    @pytest.hookimpl(hookwrapper=True, tryfirst=True)
    def pytest_sessionfinish(
        self, session: pytest.Session, exitstatus: int
    ) -> Iterator[None]:
        self.stamp("session_finish_started")
        try:
            yield
        finally:
            self.stamp("session_finish_finished")


def main() -> int:
    output = Path(os.environ["CI_STARTUP_OUTPUT"])
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite probe output: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    arguments = sys.argv[1:]
    sys.path.insert(0, str(Path.cwd()))
    probe = StartupProbe()
    exit_code = 1
    try:
        exit_code = int(pytest.main(arguments, plugins=[probe]))
        return exit_code
    finally:
        probe.stamp("pytest_main_finished")
        payload = {
            "format_version": 1,
            "python": sys.version,
            "pytest": pytest.__version__,
            "arguments": arguments,
            "exit_code": exit_code,
            "timestamps": probe.timestamps,
            "files": probe.files,
            "nodes": probe.nodes,
            "outcomes": probe.outcomes,
            "high_scope_fixtures": probe.high_scope_fixtures,
            "fixture_intervals": probe.fixture_intervals,
        }
        temporary = output.with_suffix(output.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, sort_keys=True, indent=2))
        temporary.replace(output)


if __name__ == "__main__":
    raise SystemExit(main())
