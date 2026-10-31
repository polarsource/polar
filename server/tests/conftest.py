import os

os.environ["POLAR_ENV"] = "testing"


from tests.fixtures import *  # noqa
import pytest


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line(
        "markers",
        "keep_session_state: Disable automatic session clearing before HTTP requests (for old tests only)",
    )


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        if "tinybird_workspace" in getattr(item, "fixturenames", ()):
            item.add_marker("tinybird")
