from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio

from polar.checkout.ip_geolocation import _get_client_dependency
from polar.checkout_link.app import app as checkout_link_app
from polar.config import settings
from polar.postgres import AsyncSession, get_db_session


@pytest_asyncio.fixture
async def app_client(session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient]:
    checkout_link_app.dependency_overrides[get_db_session] = lambda: session
    checkout_link_app.dependency_overrides[_get_client_dependency] = lambda: None
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=checkout_link_app),
        base_url="http://buy.polar.test",
    ) as client:
        yield client
    checkout_link_app.dependency_overrides.clear()


@pytest.mark.asyncio
class TestErrorRedirects:
    async def test_not_existing_client_secret_redirects_to_404_page(
        self, app_client: httpx.AsyncClient
    ) -> None:
        response = await app_client.get("/polar_cl_truncated")

        assert response.status_code == 302
        assert response.headers["location"] == settings.generate_frontend_url("/404")

    async def test_unmatched_path_redirects_to_frontend(
        self, app_client: httpx.AsyncClient
    ) -> None:
        response = await app_client.get("/")

        assert response.status_code == 302
        assert response.headers["location"] == settings.FRONTEND_BASE_URL
