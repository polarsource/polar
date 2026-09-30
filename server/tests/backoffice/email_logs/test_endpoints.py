from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.email.schemas import EmailTemplate
from polar.models import User, UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient]:
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
class TestListEmailLogs:
    async def test_lists_every_template_without_logs(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get("/email-logs/")

        assert response.status_code == 200
        for template in EmailTemplate:
            assert f'value="{template.value}"' in response.text
