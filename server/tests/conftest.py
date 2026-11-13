import os

os.environ["POLAR_ENV"] = "testing"


import freezegun
import pytest

if os.environ.get("POLAR_TEST_XDIST") != "true" or os.environ.get(
    "PYTEST_XDIST_WORKER"
):
    from tests.fixtures import *

freezegun.configure(extend_ignore_list=["_pytest.timing"])


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line(
        "markers",
        "keep_session_state: Disable automatic session clearing before HTTP requests (for old tests only)",
    )


@pytest.hookimpl(tryfirst=True)
def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        if "tinybird_workspace" in getattr(item, "fixturenames", ()):
            item.add_marker(pytest.mark.tinybird)
            item.add_marker(pytest.mark.xdist_group(name="tinybird"))
