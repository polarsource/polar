import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.email_update.service import EmailAlreadyInUse
from polar.email_update.service import email_update as email_update_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


@pytest.mark.anyio
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

    async def test_email_taken_since_request(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        resend_mock = mocker.patch("polar.email_update.service.resend_service")
        user = await create_user(save_fixture, email="user@example.com")
        _, token = await email_update_service.request_email_update(
            "new.email@example.com", session, AuthSubject(user, set(), None)
        )

        await create_user(save_fixture, email="New.Email@example.com")

        with pytest.raises(EmailAlreadyInUse):
            await email_update_service.verify(session, token, user)

        assert user.email == "user@example.com"
        resend_mock.enqueue_sync_user.assert_not_called()
