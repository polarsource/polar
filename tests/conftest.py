from typing import Generator

import pytest
from starlette.testclient import TestClient

from polar.app import app


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    client = TestClient(app)
    yield client  # testing happens here
