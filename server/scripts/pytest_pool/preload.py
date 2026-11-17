import contextlib
import json
import os
import resource
import sys
import time
from pathlib import Path

import pytest

from .resources import inspect_resources, require_clean
from .types import Collection, Node

ROOT = ""
MANIFEST: list[Node] = []
PHASES: dict[str, float] = {}
_STARTED = time.monotonic()


class Collector:
    @pytest.hookimpl(trylast=True)
    def pytest_collection_modifyitems(
        self, config: pytest.Config, items: list[pytest.Item]
    ) -> None:
        ordinary_path = os.environ.get("POLAR_CI_ORDINARY_FILES")
        if not ordinary_path:
            return
        ordinary = set(Path(ordinary_path).read_text().splitlines())
        kept: list[pytest.Item] = []
        excluded: list[pytest.Item] = []
        for item in items:
            selected = (
                item.get_closest_marker("tinybird")
                or item.nodeid.split("::", 1)[0] in ordinary
            )
            (kept if selected else excluded).append(item)
        items[:] = kept
        config.hook.pytest_deselected(items=excluded)

    def pytest_sessionstart(self, session: pytest.Session) -> None:
        PHASES["configuration_finished"] = time.monotonic() - _STARTED

    def pytest_collection_finish(self, session: pytest.Session) -> None:

        PHASES["collection_finished"] = time.monotonic() - _STARTED
        global ROOT
        ROOT = str(session.config.rootpath)
        for item in session.items:
            names = {
                str(
                    marker.args[0]
                    if marker.args
                    else marker.kwargs.get("name", "default")
                )
                for marker in item.iter_markers("xdist_group")
            }
            group = "_".join(sorted(names)) if names else None
            classes: list[str] = []
            parent = item.parent
            while parent is not None:
                if isinstance(parent, pytest.Class):
                    classes.append(parent.name)
                parent = parent.parent
            MANIFEST.append(
                {
                    "nodeid": item.nodeid,
                    "group": group,
                    "tinybird": item.get_closest_marker("tinybird") is not None,
                    "stock_report_nodeid": f"{item.nodeid}@{group}"
                    if group is not None
                    else item.nodeid,
                    "location": item.location,
                    "class_chain": list(reversed(classes)),
                    "test_name": item.name,
                    "module_path": str(item.path.relative_to(session.config.rootpath)),
                }
            )


def initialize() -> Collection:
    started = time.monotonic()
    directory = Path(os.environ["POLAR_CI_POOL_OUTPUT"])
    try:
        before = inspect_resources()
        arguments: list[str] = json.loads(os.environ["POLAR_CI_POOL_ARGUMENTS"])
        arguments.extend(
            [
                "--collect-only",
                "-q",
                "-o",
                f"cache_dir={directory / 'collection-cache'}",
                f"--basetemp={directory / 'collection-temp'}",
            ]
        )
        with (
            (directory / "collection.log").open("w") as output,
            contextlib.redirect_stdout(output),
            contextlib.redirect_stderr(output),
        ):
            status = pytest.main(arguments, plugins=[Collector()])
        if status != 0:
            raise RuntimeError(f"Source collection exited {status}; see collection.log")
        after = inspect_resources()
        require_clean(before, after)
        if not MANIFEST:
            raise RuntimeError("Source collection produced no node IDs")
        usage = resource.getrusage(resource.RUSAGE_SELF)
        state: Collection = {
            "ready": True,
            "nodes": MANIFEST,
            "root": ROOT,
            "python": sys.version.split()[0],
            "pytest": pytest.__version__,
            "seconds": time.monotonic() - started,
            "phases": PHASES,
            "cpu_user_seconds": usage.ru_utime,
            "cpu_system_seconds": usage.ru_stime,
            "peak_rss_native_units": usage.ru_maxrss,
            "resources": {
                "threads": after.threads,
                "sockets": sorted(after.sockets),
                "loops": after.loops,
            },
        }
    except BaseException as error:
        state = {
            "ready": False,
            "error": f"{type(error).__name__}: {error}",
            "seconds": time.monotonic() - started,
            "root": ROOT,
            "nodes": MANIFEST,
        }
    temporary = directory / "collection.json.tmp"
    temporary.write_text(json.dumps(state, indent=2))
    temporary.replace(directory / "collection.json")
    return state


STATE = initialize()
if not STATE["ready"]:
    raise SystemExit(1)
