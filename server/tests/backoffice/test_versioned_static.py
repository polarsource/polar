from collections.abc import AsyncGenerator
from pathlib import Path

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.versioned_static import get_file_version

STATIC_DIRECTORY = (
    Path(__file__).parents[2] / "polar" / "backoffice" / "static"
).resolve()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient]:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=backoffice_app), base_url="http://test"
    ) as client:
        yield client


@pytest.mark.asyncio
class TestVersionedStaticFiles:
    async def test_current_version_is_cached_and_compressed(
        self, client: httpx.AsyncClient
    ) -> None:
        version = get_file_version(str(STATIC_DIRECTORY), "logo.light.svg")

        response = await client.get(
            "/static/logo.light.svg",
            params={"v": version},
            headers={"Accept-Encoding": "gzip"},
        )

        assert response.status_code == 200
        assert response.headers["Cache-Control"] == (
            "public, max-age=31536000, immutable"
        )
        assert response.headers["Content-Encoding"] == "gzip"

    @pytest.mark.parametrize(
        "params",
        [
            pytest.param({"v": "00000000"}, id="other_version"),
            pytest.param({}, id="no_version"),
        ],
    )
    async def test_other_requests_revalidate(
        self, params: dict[str, str], client: httpx.AsyncClient
    ) -> None:
        response = await client.get("/static/logo.light.svg", params=params)

        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "no-cache"
