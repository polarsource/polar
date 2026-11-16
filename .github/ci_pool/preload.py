import contextlib
import json
import os
import resource
import time
from pathlib import Path

from .resources import inspect_resources, require_clean

READY = False
ERROR = None
ROOT = None
MANIFEST = []


class Collector:
    def pytest_collection_finish(self, session):
        import pytest

        global ROOT
        ROOT = str(session.config.rootpath)
        for item in session.items:
            names = {
                str(marker.args[0] if marker.args else marker.kwargs.get("name", "default"))
                for marker in item.iter_markers("xdist_group")
            }
            group = "_".join(sorted(names)) if names else None
            classes = []
            parent = item.parent
            while parent is not None:
                if isinstance(parent, pytest.Class):
                    classes.append(parent.name)
                parent = parent.parent
            MANIFEST.append({"nodeid": item.nodeid, "group": group,
                             "stock_report_nodeid": f"{item.nodeid}@{group}" if group is not None else item.nodeid,
                             "location": list(item.location), "class_chain": list(reversed(classes)),
                             "test_name": item.name, "module_path": str(item.path.relative_to(session.config.rootpath))})


def initialize():
    global READY, ERROR
    started = time.monotonic()
    directory = Path(os.environ["POLAR_CI_POOL_OUTPUT"])
    try:
        before = inspect_resources()
        import pytest

        arguments = json.loads(os.environ["POLAR_CI_POOL_ARGUMENTS"])
        arguments.extend(["--collect-only", "-q", "-o", f"cache_dir={directory / 'collection-cache'}",
                          f"--basetemp={directory / 'collection-temp'}"])
        with (directory / "collection.log").open("w") as output, contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            status = pytest.main(arguments, plugins=[Collector()])
        if status != 0:
            raise RuntimeError(f"Source collection exited {status}; see collection.log")
        after = inspect_resources()
        require_clean(before, after)
        if not MANIFEST:
            raise RuntimeError("Source collection produced no node IDs")
        READY = True
        usage = resource.getrusage(resource.RUSAGE_SELF)
        state = {"ready": True, "nodes": MANIFEST, "root": ROOT,
                 "seconds": time.monotonic() - started,
                 "cpu_user_seconds": usage.ru_utime, "cpu_system_seconds": usage.ru_stime,
                 "peak_rss_native_units": usage.ru_maxrss,
                 "resources": {"threads": after.threads, "sockets": sorted(after.sockets), "loops": after.loops}}
    except BaseException as error:
        ERROR = f"{type(error).__name__}: {error}"
        state = {"ready": False, "error": ERROR, "seconds": time.monotonic() - started}
    temporary = directory / "collection.json.tmp"
    temporary.write_text(json.dumps(state, indent=2))
    temporary.replace(directory / "collection.json")


initialize()
