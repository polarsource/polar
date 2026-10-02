import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.email_update.service import email_update as email_update_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


@pytest.mark.asyncio
class TestVerify:
    async def test_marks_email_verified(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.email_update.service.resend_service")
        user = await create_user(save_fixture, email_verified=False)
        _, token = await email_update_service.request_email_update(
            "new.email@example.com", session, AuthSubject(user, set(), None)
        )

        updated_user = await email_update_service.verify(session, token, user)

        assert updated_user.email == "new.email@example.com"
        assert updated_user.email_verified is True
