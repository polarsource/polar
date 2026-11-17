import json
import os
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

import pytest

SERVER = Path(__file__).resolve().parents[2]


class TestPytestPool:
    @pytest.mark.parametrize("failure", [None, "call", "setup", "teardown"])
    def test_native_outcomes_and_grouping(
        self, tmp_path: Path, failure: str | None
    ) -> None:
        (tmp_path / "pytest.ini").write_text(
            "[pytest]\nmarkers =\n    xdist_group(name): worker group\n"
        )
        (tmp_path / "test_example.py").write_text(
            dedent(
                """
                import os
                import pytest

                @pytest.fixture
                def resource():
                    assert os.environ.get("POOL_FAILURE") != "setup"
                    yield
                    assert os.environ.get("POOL_FAILURE") != "teardown"

                @pytest.mark.xdist_group("shared")
                @pytest.mark.parametrize("value", [1, 2])
                def test_group(value, worker_id):
                    assert worker_id.startswith("gw")

                def test_resource(resource):
                    assert os.environ.get("POOL_FAILURE") != "call"

                @pytest.mark.skip(reason="expected skip")
                def test_skip():
                    pass

                @pytest.mark.xfail(strict=True, reason="expected failure")
                def test_xfail():
                    assert False
                """
            )
        )
        output = tmp_path / "results"
        process = subprocess.run(
            [
                sys.executable,
                "-m",
                "scripts.pytest_pool",
                "--workers",
                "2",
                "--timeout",
                "30",
                "--output",
                str(output),
                str(tmp_path / "test_example.py"),
            ],
            cwd=tmp_path,
            check=False,
            env={
                **os.environ,
                "PYTHONPATH": str(SERVER),
                "POOL_FAILURE": failure or "",
            },
            capture_output=True,
            text=True,
            timeout=40,
        )
        assert process.returncode == int(failure is not None), process.stderr
        summary = json.loads((output / "summary.json").read_text())
        assert summary["nodes"] == 5
        assert summary["failed"] == (failure is not None)
        identities = json.loads((output / "identity-map.json").read_text())
        durations = json.loads((output / ".test_durations").read_text())
        assert set(durations) == set(identities.values())
        workers = [
            json.loads(path.read_text())
            for path in sorted(output.glob("gw*/result.json"))
        ]
        assert len(workers) == 2
        assert (
            sum(
                any("test_group" in node for node in worker["collected"])
                for worker in workers
            )
            == 1
        )
        assert summary["junit"]["tests"] == 5
        assert summary["junit"]["failures"] == int(failure == "call")
        assert summary["junit"]["errors"] == int(failure in {"setup", "teardown"})
        assert summary["outcomes"]["skipped"] == 1
        assert summary["outcomes"]["xfail"] == 1

    @pytest.mark.parametrize(
        "resource",
        [
            "import threading; threading.Thread(target=threading.Event().wait, daemon=True).start()",
            "import asyncio; loop = asyncio.new_event_loop()",
            "import socket; connection = socket.socket()",
            (
                "import ctypes; library = ctypes.CDLL(None); native = ctypes.c_ulong(); "
                "assert library.pthread_create(ctypes.byref(native), None, "
                "ctypes.cast(library.sleep, ctypes.c_void_p), ctypes.c_void_p(60)) == 0"
            ),
        ],
        ids=["thread", "loop", "socket", "native-thread"],
    )
    def test_rejects_resources_retained_during_collection(
        self, tmp_path: Path, resource: str
    ) -> None:
        (tmp_path / "pytest.ini").write_text("[pytest]\n")
        (tmp_path / "test_example.py").write_text(
            "import os\nfrom pathlib import Path\n"
            "original_fork = os.fork\n"
            "def tracked_fork():\n"
            "    Path('unexpected-fork').touch()\n"
            "    return original_fork()\n"
            "os.fork = tracked_fork\n"
            f"{resource}\n\ndef test_example():\n    assert True\n"
        )
        output = tmp_path / "results"
        process = subprocess.run(
            [
                sys.executable,
                "-m",
                "scripts.pytest_pool",
                "--workers",
                "2",
                "--timeout",
                "30",
                "--output",
                str(output),
                str(tmp_path / "test_example.py"),
            ],
            cwd=tmp_path,
            check=False,
            env={**os.environ, "PYTHONPATH": str(SERVER)},
            capture_output=True,
            text=True,
            timeout=40,
        )
        assert process.returncode != 0
        state = json.loads((output / "collection.json").read_text())
        assert not state["ready"]
        assert "Resources retained after collection" in state["error"]
        assert not list(output.glob("gw*"))
        assert not (tmp_path / "unexpected-fork").exists()
