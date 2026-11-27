from collections.abc import AsyncGenerator

import httpx2
import pytest
from pytest_mock import MockerFixture

from polar.backoffice.app import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.email.schemas import EmailTemplate
from polar.kit.utils import utc_now
from polar.models import BackofficeUserSession
from polar.models.email_log import EmailLogStatus
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_email_log


@pytest.fixture
async def backoffice_client(
    session: AsyncSession, backoffice_user_session: BackofficeUserSession
) -> AsyncGenerator[httpx2.AsyncClient]:
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_db_read_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: backoffice_user_session
    try:
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_db_read_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.anyio
class TestListEmailLogs:
    async def test_lists_every_template_without_logs(
        self, backoffice_client: httpx2.AsyncClient
    ) -> None:
        response = await backoffice_client.get("/email-logs/")

        assert response.status_code == 200
        for template in EmailTemplate:
            assert f'value="{template.value}"' in response.text

    @pytest.mark.parametrize(
        "query",
        [
            "customer@example.com",
            "Customer@Example.com",
            " customer@example.com ",
            "@example.com",
        ],
    )
    async def test_search_by_email(
        self,
        query: str,
        save_fixture: SaveFixture,
        backoffice_client: httpx2.AsyncClient,
    ) -> None:
        email_log = await create_email_log(save_fixture, created_at=utc_now())

        response = await backoffice_client.get("/email-logs/", params={"query": query})

        assert response.status_code == 200
        assert str(email_log.id) in response.text

    async def test_search_by_email_no_match(
        self, save_fixture: SaveFixture, backoffice_client: httpx2.AsyncClient
    ) -> None:
        email_log = await create_email_log(save_fixture, created_at=utc_now())

        response = await backoffice_client.get(
            "/email-logs/", params={"query": "other@example.com"}
        )

        assert response.status_code == 200
        assert str(email_log.id) not in response.text

    async def test_search_by_subject(
        self, save_fixture: SaveFixture, backoffice_client: httpx2.AsyncClient
    ) -> None:
        email_log = await create_email_log(save_fixture, created_at=utc_now())

        response = await backoffice_client.get(
            "/email-logs/", params={"query": "receipt"}
        )

        assert response.status_code == 200
        assert str(email_log.id) in response.text


@pytest.mark.anyio
class TestUnsuppress:
    @pytest.mark.parametrize(
        ("error", "shown"),
        [
            ("email.suppressed; reason=OnSuppressionList", True),
            ("email.bounced; type=Permanent", True),
            ("email.bounced; type=Transient", False),
            ("Resend request timed out", False),
        ],
    )
    async def test_button_visibility(
        self,
        error: str,
        shown: bool,
        save_fixture: SaveFixture,
        backoffice_client: httpx2.AsyncClient,
    ) -> None:
        email_log = await create_email_log(
            save_fixture,
            created_at=utc_now(),
            status=EmailLogStatus.failed,
            error=error,
        )

        response = await backoffice_client.get(f"/email-logs/{email_log.id}")

        assert response.status_code == 200
        assert ("/unsuppress" in response.text) is shown

    @pytest.mark.parametrize(
        ("removed", "message"),
        [(True, "has been unsuppressed"), (False, "on the suppression list")],
    )
    async def test_removes_suppression(
        self,
        removed: bool,
        message: str,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        backoffice_client: httpx2.AsyncClient,
    ) -> None:
        remove_suppression = mocker.patch(
            "polar.backoffice.email_logs.endpoints.email_sender.remove_suppression",
            return_value=removed,
        )
        email_log = await create_email_log(
            save_fixture, created_at=utc_now(), status=EmailLogStatus.failed
        )

        response = await backoffice_client.post(
            f"/email-logs/{email_log.id}/unsuppress"
        )

        assert response.status_code == 200
        remove_suppression.assert_awaited_once_with("customer@example.com")
        assert message in response.text
