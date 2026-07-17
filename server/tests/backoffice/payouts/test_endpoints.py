import re
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models import User
from polar.models.payout import PayoutStatus
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient, None]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_db_read_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_db_read_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.asyncio
class TestList:
    async def test_status_filter_keeps_selected_status(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get(
            "/payouts/", params={"status": PayoutStatus.pending.value}
        )

        assert response.status_code == 200
        assert re.search(
            r'<option(?=[^>]*value="pending")(?=[^>]*selected)[^>]*>\s*Pending\s*</option>',
            response.text,
        )
