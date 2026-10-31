import gc
import os

os.environ["POLAR_ENV"] = "testing"

gc.disable()

from tests.fixtures import *  # noqa
import pytest


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line(
        "markers",
        "keep_session_state: Disable automatic session clearing before HTTP requests (for old tests only)",
    )


def pytest_collection_finish(session: pytest.Session) -> None:
    """Keep the garbage collector from rescanning startup objects on every pass."""
    gc.enable()
    gc.collect()
    gc.freeze()
    gc.set_threshold(100_000, 50, 100)
