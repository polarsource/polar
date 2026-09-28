from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from starlette.types import ASGIApp, Receive, Scope, Send

from polar.observability.http_telemetry import request_path_template


class TestRequestPathTemplate:
    def test_nested_router_prefixes(self) -> None:
        checkouts_router = APIRouter(prefix="/checkouts")

        @checkouts_router.get("/{id}")
        async def get_checkout(id: str) -> None: ...

        v1_router = APIRouter(prefix="/v1")
        v1_router.include_router(checkouts_router)
        app = FastAPI()
        app.include_router(v1_router)

        templates: list[str] = []

        def capture_template(app: ASGIApp) -> ASGIApp:
            async def asgi(scope: Scope, receive: Receive, send: Send) -> None:
                await app(scope, receive, send)
                templates.append(request_path_template(scope))

            return asgi

        TestClient(capture_template(app)).get("/v1/checkouts/123")

        assert templates == ["/v1/checkouts/{id}"]
