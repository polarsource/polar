from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models.user import User
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_session


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.asyncio
class TestLayoutContentSwap:
    async def test_full_page_without_htmx_headers(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get("/")

        assert response.status_code == 200
        assert "<html" in response.text
        assert response.text.count('id="content"') == 1
        assert response.headers["cache-control"] == "private, no-store"
        assert "HX-Request" in response.headers["vary"]
        assert "HX-Boosted" in response.headers["vary"]
        assert "HX-Target" in response.headers["vary"]

    @pytest.mark.parametrize(
        "headers",
        [
            {"HX-Boosted": "true", "HX-Target": "content"},
            {"HX-Target": "content"},
            {"HX-Boosted": "true"},
        ],
    )
    async def test_partial_when_swapping_into_content(
        self, backoffice_client: httpx.AsyncClient, headers: dict[str, str]
    ) -> None:
        response = await backoffice_client.get("/", headers=headers)

        assert response.status_code == 200
        assert "<html" not in response.text
        assert 'id="content"' not in response.text
        assert "Dashboard" in response.text
        assert 'id="menu"' in response.text
        assert 'id="page_title"' in response.text

    async def test_hx_request_alone_still_returns_full_page(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get("/", headers={"HX-Request": "true"})

        assert response.status_code == 200
        assert "<html" in response.text
        assert response.text.count('id="content"') == 1
