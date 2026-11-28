from __future__ import annotations

import typing

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from polar.integrations.fastapi import PolarDependency, PolarMiddleware
from polar.v2026_04 import PolarAsync

PolarClient = PolarDependency[PolarAsync]


@pytest.fixture
def app() -> FastAPI:
    app = FastAPI()

    @app.get("/")
    async def version(request: Request, polar: PolarClient) -> dict[str, str]:
        typing.assert_type(polar, PolarAsync)
        assert polar is request.state.polar
        return {"version": polar.version}

    return app


def test_injects_the_client_created_by_polar_middleware(app: FastAPI) -> None:
    app.add_middleware(
        PolarMiddleware, client_class=PolarAsync, access_token="test-token"
    )

    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"version": PolarAsync.version}


def test_reports_a_missing_polar_client(app: FastAPI) -> None:
    with (
        TestClient(app) as client,
        pytest.raises(RuntimeError, match="Did you forget to add PolarMiddleware"),
    ):
        client.get("/")
