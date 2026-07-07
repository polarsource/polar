from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.kit.utils import utc_now
from polar.models import User, UserSession


@pytest.fixture(autouse=True)
def mock_enqueue_email(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.email_update.service.enqueue_email_template")


@pytest.mark.asyncio
class TestRequestEmailUpdate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/email-update/request", json={"email": "new.email@example.com"}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        assert isinstance(auth_subject.session, UserSession)
        auth_subject.session.created_at = utc_now() - timedelta(minutes=10)

        response = await client.post(
            "/v1/email-update/request", json={"email": "new.email@example.com"}
        )

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session(
        self, client: AsyncClient, mock_enqueue_email: MagicMock
    ) -> None:
        response = await client.post(
            "/v1/email-update/request", json={"email": "new.email@example.com"}
        )

        assert response.status_code == 200
        mock_enqueue_email.assert_called_once()
