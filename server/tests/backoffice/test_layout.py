from collections.abc import AsyncGenerator

import httpx2
import pytest

from polar.backoffice.app import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models.backoffice_user_session import BackofficeUserSession
from polar.postgres import AsyncSession, get_db_session


@pytest.fixture
async def backoffice_client(
    session: AsyncSession, backoffice_user_session: BackofficeUserSession
) -> AsyncGenerator[httpx2.AsyncClient]:
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: backoffice_user_session
    try:
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.anyio
class TestLayoutContentSwap:
    async def test_full_page_without_htmx_headers(
        self, backoffice_client: httpx2.AsyncClient
    ) -> None:
        response = await backoffice_client.get("/")

        assert response.status_code == 200
        assert "<html" in response.text
        assert response.text.count('id="content"') == 1
        assert 'id="toast"' in response.text
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
        self, backoffice_client: httpx2.AsyncClient, headers: dict[str, str]
    ) -> None:
        response = await backoffice_client.get("/", headers=headers)

        assert response.status_code == 200
        assert "<html" not in response.text
        assert 'id="content"' not in response.text
        assert "Dashboard" in response.text
        assert 'id="menu"' in response.text
        assert 'id="page_title"' in response.text
        assert 'id="toast"' in response.text

    async def test_hx_request_alone_still_returns_full_page(
        self, backoffice_client: httpx2.AsyncClient
    ) -> None:
        response = await backoffice_client.get("/", headers={"HX-Request": "true"})

        assert response.status_code == 200
        assert "<html" in response.text
        assert response.text.count('id="content"') == 1
