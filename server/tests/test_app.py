from fastapi import FastAPI, Response
from fastapi.testclient import TestClient

from polar.app import configure_cors
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
