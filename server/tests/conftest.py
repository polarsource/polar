import os

os.environ["POLAR_ENV"] = "testing"


from tests.fixtures import *  # noqa


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers",
        "keep_session_state: Disable automatic session clearing before HTTP requests (for old tests only)",
    )
