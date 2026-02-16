import os

os.environ["POLAR_ENV"] = "testing"


from tests.fixtures import *  # noqa
import pytest


TINYBIRD_GROUP_PATHS = (
    "tests/integrations/tinybird/",
    "tests/metrics/test_tinybird_metrics.py",
    "tests/metrics/test_settlement_comparison.py",
)


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line(
        "markers",
        "keep_session_state: Disable automatic session clearing before HTTP requests (for old tests only)",
    )
    config.addinivalue_line(
        "markers",
        "xdist_group(name): Group tests to run on the same xdist worker when using --dist=loadgroup",
    )


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    """Run Tinybird-backed tests sequentially on a single xdist worker."""
    if not config.pluginmanager.hasplugin("xdist"):
        return

    for item in items:
        item_path = str(getattr(item, "path", item.fspath)).replace("\\", "/")
        if any(path in item_path for path in TINYBIRD_GROUP_PATHS):
            item.add_marker(pytest.mark.xdist_group(name="tinybird"))
            continue

        fixturenames = set(getattr(item, "fixturenames", ()))
        if "tinybird_workspace" in fixturenames or "tinybird_client" in fixturenames:
            item.add_marker(pytest.mark.xdist_group(name="tinybird"))
