import os
from typing import Generator

import pytest
from starlette.testclient import TestClient

os.environ["POLAR_ENV"] = "testing"

from polar.app import app  # noqa: E402


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    client = TestClient(app)
    yield client
