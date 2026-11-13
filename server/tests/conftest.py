import os
from pathlib import Path

os.environ["POLAR_ENV"] = "testing"


import freezegun
import pytest

if os.environ.get("POLAR_TEST_XDIST") != "true" or os.environ.get(
    "PYTEST_XDIST_WORKER"
):
    from tests.fixtures import *

freezegun.configure(extend_ignore_list=["_pytest.timing"])

_ci_collection_paths: set[Path] | None = None
if test_files_path := os.environ.get("POLAR_TEST_FILES"):
    test_files = {
        Path(__file__).parents[1] / file
        for file in Path(test_files_path).read_text().splitlines()
    }
    _ci_collection_paths = test_files | {
        parent for file in test_files for parent in file.parents
    }


def pytest_ignore_collect(collection_path: Path) -> bool | None:
    if _ci_collection_paths is not None:
        return collection_path not in _ci_collection_paths
    return None


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line(
        "markers",
        "keep_session_state: Disable automatic session clearing before HTTP requests (for old tests only)",
    )


@pytest.hookimpl(tryfirst=True)
def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    tinybird_files = set(
        (Path(__file__).parent / "tinybird-files.txt").read_text().splitlines()
    )
    for item in items:
        if "tinybird_workspace" in getattr(item, "fixturenames", ()):
            item.add_marker(pytest.mark.tinybird)
            item.add_marker(pytest.mark.xdist_group(name="tinybird"))
        if (
            os.environ.get("POLAR_TEST_XDIST") == "true"
            and item.get_closest_marker("tinybird")
            and item.nodeid.split("::", 1)[0] not in tinybird_files
        ):
            raise pytest.UsageError(
                f"Add {item.nodeid.split('::', 1)[0]} to tests/tinybird-files.txt "
                "so the Tinybird CI job runs it."
            )
