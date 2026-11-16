import argparse
import collections
import contextlib
import json
import multiprocessing
import os
import resource
import sys
import time
import xml.etree.ElementTree as ET
from collections.abc import Mapping, Sequence
from multiprocessing.connection import Connection
from multiprocessing.process import BaseProcess
from pathlib import Path

import pytest

from scripts.merge_test_durations import merge_durations

from .types import ChildResult, Collection, Node, Report

_CLOCKS = (time.perf_counter, time.process_time)


def write_json(path: Path, value: object) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, indent=2))
    temporary.replace(path)


class ChildPlugin:
    def __init__(self, worker: str) -> None:
        self.worker = worker
        self.collected: list[str] = []
        self.reports: list[Report] = []
        self.started = _CLOCKS[0]()
        self.phases: dict[str, float] = {}

    def pytest_configure(self, config: pytest.Config) -> None:
        config.pluginmanager.register(
            WorkerIdentity(self.worker), "ci-pool-worker-identity"
        )

    def pytest_sessionstart(self, session: pytest.Session) -> None:
        self.phases["configuration_finished"] = _CLOCKS[0]() - self.started

    def pytest_collection_finish(self, session: pytest.Session) -> None:
        self.phases["collection_finished"] = _CLOCKS[0]() - self.started
        self.collected = [item.nodeid for item in session.items]

    def pytest_runtest_logreport(self, report: pytest.TestReport) -> None:
        self.reports.append(
            {
                "nodeid": report.nodeid,
                "when": report.when,
                "outcome": report.outcome,
                "duration": report.duration,
                "wasxfail": getattr(report, "wasxfail", None),
            }
        )


class WorkerIdentity:
    def __init__(self, worker: str) -> None:
        self.worker = worker

    @pytest.fixture(scope="session")
    def worker_id(self) -> str:
        return self.worker


def source_collection() -> Collection:
    return sys.modules["scripts.pytest_pool.preload"].STATE


def probe(connection: Connection) -> None:
    connection.send(source_collection())
    connection.close()


def child(
    worker: str, nodeids: list[str], arguments: list[str], directory: Path
) -> None:
    state = source_collection()
    if not state["ready"]:
        raise RuntimeError(f"Unsafe preload: {state.get('error')}")
    os.chdir(state["root"])
    os.environ["PYTEST_XDIST_WORKER"] = worker
    os.environ["PYTEST_XDIST_WORKER_COUNT"] = os.environ["POLAR_CI_POOL_WORKERS"]
    plugin = ChildPlugin(worker)
    started = time.monotonic()
    arguments = [
        *arguments,
        *nodeids,
        "-n",
        "0",
        "-q",
        "--store-durations",
        "--clean-durations",
        f"--durations-path={directory / '.test_durations'}",
        f"--junitxml={directory / 'junit.xml'}",
        f"--basetemp={directory / 'temp'}",
        "-o",
        f"cache_dir={directory / 'cache'}",
    ]
    with (
        (directory / "pytest.log").open("w") as output,
        contextlib.redirect_stdout(output),
        contextlib.redirect_stderr(output),
    ):
        status = pytest.main(arguments, plugins=[plugin])
    usage = resource.getrusage(resource.RUSAGE_SELF)
    write_json(
        directory / "result.json",
        {
            "worker": worker,
            "pid": os.getpid(),
            "exit_code": int(status),
            "assigned": nodeids,
            "collected": plugin.collected,
            "reports": plugin.reports,
            "phases": plugin.phases,
            "seconds": time.monotonic() - started,
            "cpu_user_seconds": usage.ru_utime,
            "cpu_system_seconds": usage.ru_stime,
            "peak_rss_native_units": usage.ru_maxrss,
        },
    )
    raise SystemExit(int(status))


def assign(
    nodes: Sequence[Node], workers: int, weights: Mapping[str, float]
) -> tuple[list[list[str]], list[float]]:
    tinybird = [node for node in nodes if node.get("tinybird")]
    if tinybird:
        if workers < 2 or len({node["group"] for node in tinybird}) != 1:
            raise RuntimeError(
                "Tinybird must occupy one dedicated worker beside ordinary tests"
            )
        ordinary, ordinary_estimates = assign(
            [node for node in nodes if not node.get("tinybird")], workers - 1, weights
        )
        return [[node["nodeid"] for node in tinybird], *ordinary], [
            0.0,
            *ordinary_estimates,
        ]
    groups: dict[tuple[str, str], list[str]] = collections.defaultdict(list)
    estimates: dict[str, float] = {}
    positive = [
        value
        for value in weights.values()
        if isinstance(value, (float, int)) and value > 0
    ]
    fallback = sum(positive) / len(positive) if positive else 1.0
    for node in nodes:
        nodeid, group = node["nodeid"], node["group"]
        key = ("group", group) if group is not None else ("node", nodeid)
        groups[key].append(nodeid)
        estimates[nodeid] = weights.get(
            nodeid, weights.get(f"{nodeid}@{group}", fallback) if group else fallback
        )
    bins: list[list[str]] = [[] for _ in range(workers)]
    loads = [0.0] * workers
    units = sorted(
        groups.values(), key=lambda ids: (-sum(estimates[node] for node in ids), ids)
    )
    for unit in units:
        owner = min(range(workers), key=lambda index: (loads[index], index))
        bins[owner].extend(unit)
        loads[owner] += sum(estimates[node] for node in unit)
    positions = {node["nodeid"]: index for index, node in enumerate(nodes)}
    file_weights: dict[str, float] = collections.defaultdict(float)
    for nodeid, estimate in estimates.items():
        file_weights[nodeid.split("::", 1)[0]] += estimate
    for assignments in bins:
        assignments.sort(
            key=lambda nodeid: (
                -file_weights[nodeid.split("::", 1)[0]],
                nodeid.split("::", 1)[0],
                positions[nodeid],
            )
        )
    return bins, loads


def verify(
    nodes: Sequence[Node], children: Sequence[BaseProcess], directory: Path
) -> tuple[list[ChildResult], bool]:
    expected = collections.Counter(node["nodeid"] for node in nodes)
    actual: collections.Counter[str] = collections.Counter()
    owners: dict[str, int] = {}
    records: list[ChildResult] = []
    failure = False
    for index, process in enumerate(children):
        path = directory / f"gw{index}" / "result.json"
        if not path.exists():
            raise RuntimeError(
                f"Missing {path.name} for gw{index}; exit={process.exitcode}; see gw{index}/pytest.log"
            )
        result: ChildResult = json.loads(path.read_text())
        if collections.Counter(result["assigned"]) != collections.Counter(
            result["collected"]
        ):
            raise RuntimeError(f"gw{index} changed its assigned source collection")
        actual.update(result["collected"])
        for nodeid in result["collected"]:
            owners[nodeid] = index
        reports: dict[str, list[Report]] = collections.defaultdict(list)
        for report in result["reports"]:
            reports[report["nodeid"]].append(report)
        if set(reports) != set(result["collected"]):
            raise RuntimeError(f"gw{index} report membership differs from collection")
        for nodeid, phases in reports.items():
            counts = collections.Counter(record["when"] for record in phases)
            if counts["setup"] != 1 or counts["teardown"] != 1 or counts["call"] > 1:
                raise RuntimeError(
                    f"Incomplete/duplicate protocol for {nodeid}: {counts}"
                )
            setup = next(record for record in phases if record["when"] == "setup")
            if setup["outcome"] == "passed" and counts["call"] != 1:
                raise RuntimeError(f"Missing call after successful setup: {nodeid}")
        failure |= process.exitcode != 0 or result["exit_code"] != 0
        records.append(result)
    if expected != actual:
        missing, extra = expected - actual, actual - expected
        raise RuntimeError(
            f"Node multiset differs: missing={list(missing.items())[:5]}, extra={list(extra.items())[:5]}"
        )
    groups: dict[str, set[int]] = collections.defaultdict(set)
    for node in nodes:
        if node["group"] is not None:
            groups[node["group"]].add(owners[node["nodeid"]])
    if any(len(values) != 1 for values in groups.values()):
        raise RuntimeError("A source xdist_group crossed worker boundaries")
    return records, failure


def merge_artifacts(
    directory: Path, workers: int, identities: Mapping[str, str], tinybird_ids: set[str]
) -> dict[str, int]:
    paths = [directory / f"gw{index}" / ".test_durations" for index in range(workers)]
    durations = merge_durations(paths)
    stock_durations = {
        identities[source]: duration
        for source, duration in durations.items()
        if source not in tinybird_ids
    }
    if len(stock_durations) != len(durations) - len(tinybird_ids):
        raise RuntimeError("Canonical duration identities collided")
    write_json(directory / ".test_durations", stock_durations)
    root = ET.Element("testsuites", name="pytest pool")
    totals = {"tests": 0, "errors": 0, "failures": 0, "skipped": 0}
    seconds = 0.0
    for index in range(workers):
        tree = ET.parse(directory / f"gw{index}" / "junit.xml").getroot()
        if tinybird_ids and index == 0:
            ET.ElementTree(tree).write(
                directory / "tinybird-junit.xml", encoding="utf-8", xml_declaration=True
            )
            continue
        suites = [tree] if tree.tag == "testsuite" else list(tree)
        for suite in suites:
            if suite.tag != "testsuite":
                raise RuntimeError("Unexpected child JUnit root")
            for key in totals:
                totals[key] += int(suite.get(key, "0"))
            seconds += float(suite.get("time", "0"))
            root.append(suite)
    root.attrib.update({key: str(value) for key, value in totals.items()})
    root.set("time", str(seconds))
    temporary = directory / "junit.xml.tmp"
    ET.ElementTree(root).write(temporary, encoding="utf-8", xml_declaration=True)
    temporary.replace(directory / "junit.xml")
    return totals


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--weights", type=Path)
    parser.add_argument("--ordinary-files", type=Path)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--marker", default="not tinybird and not benchmark")
    parser.add_argument("paths", nargs="+", type=Path)
    options = parser.parse_args()
    if options.workers < 1 or not 1 <= options.timeout <= 900:
        parser.error("workers must be positive and timeout between 1 and 900")
    child_options = ["-m", options.marker, "--no-cov", "--durations=40"]
    arguments = [*[str(path) for path in options.paths], *child_options]
    directory = options.output.resolve()
    directory.mkdir(parents=True, exist_ok=False)
    weights: dict[str, float] = (
        json.loads(options.weights.read_text()) if options.weights else {}
    )
    os.environ["POLAR_CI_POOL_ARGUMENTS"] = json.dumps(arguments)
    if options.ordinary_files:
        os.environ["POLAR_CI_ORDINARY_FILES"] = str(options.ordinary_files.resolve())
    else:
        os.environ.pop("POLAR_CI_ORDINARY_FILES", None)
    os.environ["POLAR_CI_POOL_OUTPUT"] = str(directory)
    os.environ["POLAR_CI_POOL_WORKERS"] = str(options.workers)
    multiprocessing.set_forkserver_preload(["scripts.pytest_pool.preload"])
    context = multiprocessing.get_context("forkserver")
    receive, send = context.Pipe(duplex=False)
    witness = context.Process(target=probe, args=(send,))
    started = time.monotonic()
    deadline = started + options.timeout
    witness.start()
    send.close()
    if not receive.poll(max(0, deadline - time.monotonic())):
        raise RuntimeError("Preload exceeded pool deadline")
    state: Collection = receive.recv()
    receive.close()
    witness.join(max(0, deadline - time.monotonic()))
    if witness.exitcode != 0 or not state["ready"]:
        raise RuntimeError(
            f"Source preload rejected: {state.get('error')}; see collection.json"
        )
    counts = collections.Counter(node["nodeid"] for node in state["nodes"])
    if any(count != 1 for count in counts.values()):
        raise RuntimeError("Source collection contains duplicate node IDs")
    identities = {
        node["nodeid"]: node["stock_report_nodeid"] for node in state["nodes"]
    }
    if len(set(identities.values())) != len(identities):
        raise RuntimeError("Stock xdist report identities collided")
    write_json(directory / "identity-map.json", identities)
    bins, estimates = assign(state["nodes"], options.workers, weights)
    if any(not unit for unit in bins):
        raise RuntimeError("Unexpected empty child assignment")
    children: list[BaseProcess] = []
    for index, nodeids in enumerate(bins):
        child_directory = directory / f"gw{index}"
        child_directory.mkdir()
        children.append(
            context.Process(
                target=child,
                args=(f"gw{index}", nodeids, child_options, child_directory),
            )
        )
    for process in children:
        process.start()
    for process in children:
        process.join(max(0, deadline - time.monotonic()))
        if process.is_alive():
            raise RuntimeError("Child execution exceeded pool deadline")
    records, failure = verify(state["nodes"], children, directory)
    tinybird_ids = {node["nodeid"] for node in state["nodes"] if node.get("tinybird")}
    if tinybird_ids and set(records[0]["collected"]) != tinybird_ids:
        raise RuntimeError("Tinybird group did not exclusively occupy worker gw0")
    totals = merge_artifacts(directory, options.workers, identities, tinybird_ids)
    outcomes: collections.Counter[str] = collections.Counter()
    for result in records:
        for report in result["reports"]:
            if report["when"] == "call" or (
                report["when"] == "setup" and report["outcome"] != "passed"
            ):
                outcome = (
                    ("xpass" if report["outcome"] == "passed" else "xfail")
                    if report["wasxfail"]
                    else report["outcome"]
                )
                outcomes[outcome] += 1
    summary = {
        "nodes": sum(counts.values()),
        "workers": options.workers,
        "seconds": time.monotonic() - started,
        "failed": failure,
        "outcomes": outcomes,
        "junit": totals,
        "predicted_child_seconds": estimates,
        "preload": json.loads((directory / "collection.json").read_text())
        | {"nodes": len(counts)},
        "children": [
            {
                key: value
                for key, value in result.items()
                if key not in {"assigned", "collected", "reports"}
            }
            for result in records
        ],
    }
    write_json(directory / "summary.json", summary)
    print(json.dumps(summary))
    return int(failure)


if __name__ == "__main__":
    raise SystemExit(main())
