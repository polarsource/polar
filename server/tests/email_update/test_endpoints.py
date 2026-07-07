from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import User


@pytest.fixture(autouse=True)
def mock_enqueue_email(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.email_update.service.enqueue_email_template")


@pytest.mark.asyncio
class TestRequestEmailUpdate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/email-update/request", json={"email": "new@example.com"}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_identical_response_for_fresh_and_taken_email(
        self,
        client: AsyncClient,
        user_second: User,
    ) -> None:
        fresh_response = await client.post(
            "/v1/email-update/request", json={"email": "fresh@example.com"}
        )
        taken_response = await client.post(
            "/v1/email-update/request", json={"email": user_second.email}
        )

        assert fresh_response.status_code == taken_response.status_code == 200
        assert fresh_response.json() == taken_response.json()
