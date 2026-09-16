import pytest
from fastapi import FastAPI, Response
from fastapi.testclient import TestClient

from polar.app import configure_cors, create_app
from polar.config import settings
from polar.kit.versioning import VERSION_HEADER


def test_external_cors_allows_and_exposes_version_header() -> None:
    app = FastAPI()
    configure_cors(app)

    @app.get("/")
    async def endpoint(response: Response) -> None:
        response.headers[VERSION_HEADER] = "2026-04"

    client = TestClient(app)
    origin = "https://external.example.com"

    preflight_response = client.options(
        "/",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": VERSION_HEADER,
        },
    )
    assert preflight_response.status_code == 200
    assert (
        VERSION_HEADER.lower()
        in preflight_response.headers["Access-Control-Allow-Headers"].lower()
    )

    response = client.get("/", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers["Access-Control-Expose-Headers"] == VERSION_HEADER


@pytest.mark.parametrize("backoffice_enabled", [True, False])
@pytest.mark.parametrize("backoffice_host", [None, "backoffice.example.com"])
def test_backoffice_enabled(
    monkeypatch: pytest.MonkeyPatch,
    backoffice_enabled: bool,
    backoffice_host: str | None,
) -> None:
    monkeypatch.setattr(settings, "BACKOFFICE_ENABLED", backoffice_enabled)
    monkeypatch.setattr(settings, "BACKOFFICE_HOST", backoffice_host)
    client = TestClient(create_app(), base_url="https://backoffice.example.com")
    prefix = "/backoffice" if backoffice_host is None else ""

    response = client.get(f"{prefix}/static/logo.light.svg")

    assert response.status_code == (200 if backoffice_enabled else 404)


@pytest.mark.parametrize("backoffice_host", [None, "backoffice.example.com"])
def test_disabled_backoffice_routes(
    monkeypatch: pytest.MonkeyPatch, backoffice_host: str | None
) -> None:
    monkeypatch.setattr(settings, "BACKOFFICE_ENABLED", False)
    monkeypatch.setattr(settings, "BACKOFFICE_HOST", backoffice_host)
    client = TestClient(create_app(), base_url="https://api.example.com")

    for host in ["api.example.com", "backoffice.example.com"]:
        for path in [
            "/backoffice/",
            "/backoffice/impersonation/end",
            "/impersonation/end",
        ]:
            response = client.get(path, headers={"Host": host})
            assert response.status_code == 404

    if backoffice_host is not None:
        assert (
            settings.generate_backoffice_url("/users")
            == "https://backoffice.example.com/users"
        )
