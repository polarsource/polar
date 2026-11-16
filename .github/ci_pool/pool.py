import argparse
import collections
import contextlib
import json
import multiprocessing
import os
import resource
import time
import xml.etree.ElementTree as ET
from pathlib import Path


def write_json(path, value):
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, indent=2))
    temporary.replace(path)


class ChildPlugin:
    def __init__(self, worker):
        self.worker = worker
        self.collected = []
        self.reports = []

    def pytest_configure(self, config):
        import pytest

        worker = self.worker
        class Identity:
            @pytest.fixture(scope="session")
            def worker_id(self):
                return worker
        config.pluginmanager.register(Identity(), "ci-pool-worker-identity")

    def pytest_collection_finish(self, session):
        self.collected = [item.nodeid for item in session.items]

    def pytest_runtest_logreport(self, report):
        self.reports.append({"nodeid": report.nodeid, "when": report.when, "outcome": report.outcome,
                             "duration": report.duration, "wasxfail": getattr(report, "wasxfail", None)})


def probe(connection):
    from . import preload

    connection.send({"ready": preload.READY, "error": preload.ERROR,
                     "nodes": preload.MANIFEST if preload.READY else []})
    connection.close()


def child(worker, nodeids, arguments, directory):
    from . import preload

    if not preload.READY:
        raise RuntimeError(f"Unsafe preload: {preload.ERROR}")
    directory = Path(directory)
    os.chdir(preload.ROOT)
    os.environ["PYTEST_XDIST_WORKER"] = worker
    os.environ["PYTEST_XDIST_WORKER_COUNT"] = os.environ["POLAR_CI_POOL_WORKERS"]
    import pytest

    plugin = ChildPlugin(worker)
    started = time.monotonic()
    arguments = [*arguments, *nodeids, "-n", "0", "-q", "--store-durations", "--clean-durations",
                 f"--durations-path={directory / '.test_durations'}",
                 f"--junitxml={directory / 'junit.xml'}", f"--basetemp={directory / 'temp'}",
                 "-o", f"cache_dir={directory / 'cache'}"]
    with (directory / "pytest.log").open("w") as output, contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
        status = pytest.main(arguments, plugins=[plugin])
    usage = resource.getrusage(resource.RUSAGE_SELF)
    write_json(directory / "result.json", {"worker": worker, "pid": os.getpid(), "exit_code": int(status),
               "assigned": nodeids, "collected": plugin.collected, "reports": plugin.reports,
               "seconds": time.monotonic() - started, "cpu_user_seconds": usage.ru_utime,
               "cpu_system_seconds": usage.ru_stime, "peak_rss_native_units": usage.ru_maxrss})
    raise SystemExit(int(status))


def assign(nodes, workers, weights):
    groups = collections.defaultdict(list)
    estimates = {}
    positive = [value for value in weights.values() if isinstance(value, (float, int)) and value > 0]
    fallback = sum(positive) / len(positive) if positive else 1.0
    for node in nodes:
        nodeid, group = node["nodeid"], node["group"]
        key = ("group", group) if group is not None else ("node", nodeid)
        groups[key].append(nodeid)
        estimates[nodeid] = weights.get(nodeid, weights.get(f"{nodeid}@{group}", fallback) if group else fallback)
    bins = [[] for _ in range(workers)]
    loads = [0.0] * workers
    units = sorted(groups.values(), key=lambda ids: (-sum(estimates[node] for node in ids), ids))
    for unit in units:
        owner = min(range(workers), key=lambda index: (loads[index], index))
        bins[owner].extend(unit)
        loads[owner] += sum(estimates[node] for node in unit)
    return bins, loads


def verify(nodes, children, directory):
    expected = collections.Counter(node["nodeid"] for node in nodes)
    actual = collections.Counter()
    owners = {}
    records = []
    failure = False
    for index, process in enumerate(children):
        path = directory / f"gw{index}" / "result.json"
        if not path.exists():
            raise RuntimeError(f"Missing {path.name} for gw{index}; exit={process.exitcode}; see gw{index}/pytest.log")
        result = json.loads(path.read_text())
        if collections.Counter(result["assigned"]) != collections.Counter(result["collected"]):
            raise RuntimeError(f"gw{index} changed its assigned source collection")
        actual.update(result["collected"])
        for nodeid in result["collected"]:
            owners[nodeid] = index
        reports = collections.defaultdict(list)
        for report in result["reports"]:
            reports[report["nodeid"]].append(report)
        if set(reports) != set(result["collected"]):
            raise RuntimeError(f"gw{index} report membership differs from collection")
        for nodeid, phases in reports.items():
            counts = collections.Counter(record["when"] for record in phases)
            if counts["setup"] != 1 or counts["teardown"] != 1 or counts["call"] > 1:
                raise RuntimeError(f"Incomplete/duplicate protocol for {nodeid}: {counts}")
            setup = next(record for record in phases if record["when"] == "setup")
            if setup["outcome"] == "passed" and counts["call"] != 1:
                raise RuntimeError(f"Missing call after successful setup: {nodeid}")
        failure |= process.exitcode != 0 or result["exit_code"] != 0
        records.append(result)
    if expected != actual:
        missing, extra = expected - actual, actual - expected
        raise RuntimeError(f"Node multiset differs: missing={list(missing.items())[:5]}, extra={list(extra.items())[:5]}")
    groups = collections.defaultdict(set)
    for node in nodes:
        if node["group"] is not None:
            groups[node["group"]].add(owners[node["nodeid"]])
    if any(len(values) != 1 for values in groups.values()):
        raise RuntimeError("A source xdist_group crossed worker boundaries")
    return records, failure


def merge_artifacts(directory, workers, identities):
    from scripts.merge_test_durations import merge_durations

    paths = [directory / f"gw{index}" / ".test_durations" for index in range(workers)]
    durations = merge_durations(paths)
    stock_durations = {identities[source]: duration for source, duration in durations.items()}
    if len(stock_durations) != len(durations):
        raise RuntimeError("Canonical duration identities collided")
    write_json(directory / ".test_durations", stock_durations)
    root = ET.Element("testsuites", name="pytest pool")
    totals = dict(tests=0, errors=0, failures=0, skipped=0)
    seconds = 0.0
    for index in range(workers):
        tree = ET.parse(directory / f"gw{index}" / "junit.xml").getroot()
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--weights", type=Path)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    options = parser.parse_args()
    if options.workers < 1 or not 1 <= options.timeout <= 900:
        parser.error("workers must be positive and timeout between1 and900")
    arguments = options.arguments[1:] if options.arguments[:1] == ["--"] else options.arguments
    discovery = [value for value in arguments if not value.startswith("-")]
    child_options = [value for value in arguments if value.startswith("-")]
    if not discovery:
        parser.error("Provide discovery paths after --; options with values use --option=value")
    for value in child_options:
        if value.startswith(("--junit", "--durations-path", "--basetemp", "-n", "--numprocesses",
                             "--store-durations", "--clean-durations")):
            parser.error(f"The pool owns child artifacts and process count: {value}")
    directory = options.output.resolve()
    directory.mkdir(parents=True, exist_ok=False)
    weights = json.loads(options.weights.read_text()) if options.weights else {}
    os.environ["POLAR_CI_POOL_ARGUMENTS"] = json.dumps(arguments)
    os.environ["POLAR_CI_POOL_OUTPUT"] = str(directory)
    os.environ["POLAR_CI_POOL_WORKERS"] = str(options.workers)
    multiprocessing.set_forkserver_preload(["ci_pool.preload"])
    context = multiprocessing.get_context("forkserver")
    receive, send = context.Pipe(duplex=False)
    witness = context.Process(target=probe, args=(send,))
    started = time.monotonic()
    deadline = started + options.timeout
    witness.start()
    send.close()
    if not receive.poll(max(0, deadline - time.monotonic())):
        raise RuntimeError("Preload exceeded pool deadline")
    state = receive.recv()
    witness.join(max(0, deadline - time.monotonic()))
    if witness.exitcode != 0 or not state["ready"]:
        raise RuntimeError(f"Source preload rejected: {state['error']}; see collection.json")
    counts = collections.Counter(node["nodeid"] for node in state["nodes"])
    if any(count != 1 for count in counts.values()):
        raise RuntimeError("Source collection contains duplicate node IDs")
    identities = {node["nodeid"]: node["stock_report_nodeid"] for node in state["nodes"]}
    if len(set(identities.values())) != len(identities):
        raise RuntimeError("Stock xdist report identities collided")
    write_json(directory / "identity-map.json", identities)
    bins, estimates = assign(state["nodes"], options.workers, weights)
    if any(not unit for unit in bins):
        raise RuntimeError("Unexpected empty child assignment")
    children = []
    for index, nodeids in enumerate(bins):
        child_directory = directory / f"gw{index}"
        child_directory.mkdir()
        children.append(context.Process(target=child, args=(f"gw{index}", nodeids, child_options, str(child_directory))))
    for process in children:
        process.start()
    for process in children:
        process.join(max(0, deadline - time.monotonic()))
        if process.is_alive():
            raise RuntimeError("Child execution exceeded pool deadline")
    records, failure = verify(state["nodes"], children, directory)
    totals = merge_artifacts(directory, options.workers, identities)
    outcomes = collections.Counter()
    for result in records:
        for report in result["reports"]:
            if report["when"] == "call" or (report["when"] == "setup" and report["outcome"] != "passed"):
                outcome = ("xpass" if report["outcome"] == "passed" else "xfail") if report["wasxfail"] else report["outcome"]
                outcomes[outcome] += 1
    summary = {"nodes": sum(counts.values()), "workers": options.workers,
               "seconds": time.monotonic() - started, "failed": failure,
               "outcomes": outcomes, "junit": totals, "predicted_child_seconds": estimates,
               "preload": json.loads((directory / "collection.json").read_text()) | {"nodes": len(counts)},
               "children": [{key: value for key, value in result.items() if key not in {"assigned", "collected", "reports"}}
                            for result in records]}
    write_json(directory / "summary.json", summary)
    print(json.dumps(summary))
    return int(failure)


if __name__ == "__main__":
    raise SystemExit(main())
