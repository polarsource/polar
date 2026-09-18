from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models import User
from polar.models.user import IdentityVerificationStatus
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_session
from tests.fixtures.database import SaveFixture


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
class TestDeleteUser:
    async def test_delete_user_redacts_identity_verification(
        self,
        mocker: MockerFixture,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_second: User,
    ) -> None:
        """The backoffice delete endpoint redacts an in-flight Stripe Identity
        session because it reuses soft_delete_user.
        """
        user_second.identity_verification_id = "vs_backoffice_delete"
        user_second.identity_verification_status = IdentityVerificationStatus.pending
        await save_fixture(user_second)

        redact_mock = mocker.patch(
            "polar.user.service.stripe_service.redact_verification_session",
            new_callable=mocker.AsyncMock,
        )

        response = await backoffice_client.post(
            f"/users/{user_second.id}/delete",
            data={"confirm": "true"},
        )

        # The users delete endpoint bare-returns (200) after add_toast; assert
        # the side effects.
        assert response.status_code == 200
        redact_mock.assert_awaited_once_with("vs_backoffice_delete")

        refreshed = (
            (await session.execute(select(User).where(User.id == user_second.id)))
            .unique()
            .scalar_one()
        )
        assert refreshed.identity_verification_id is None
        assert (
            refreshed.identity_verification_status
            == IdentityVerificationStatus.unverified
        )
        assert refreshed.deleted_at is not None
