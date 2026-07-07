from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.email.schemas import EmailUpdateAlreadyRegisteredEmail
from polar.email_update.service import (
    TOKEN_PREFIX,
    EmailAlreadyInUse,
    InvalidEmailUpdate,
)
from polar.email_update.service import email_update as email_update_service
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.utils import utc_now
from polar.models import EmailVerification, User
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.fixture(autouse=True)
def mock_enqueue_email(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.email_update.service.enqueue_email_template")


async def _create_verification(
    save_fixture: SaveFixture,
    user: User,
    email: str = "new@example.com",
) -> tuple[EmailVerification, str]:
    token, token_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix=TOKEN_PREFIX
    )
    record = EmailVerification(email=email, token_hash=token_hash, user=user)
    await save_fixture(record)
    return record, token


@pytest.mark.asyncio
class TestRequestEmailUpdate:
    @pytest.mark.auth
    async def test_fresh_email(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        mock_enqueue_email: MagicMock,
    ) -> None:
        result = await email_update_service.request_email_update(
            "fresh@example.com", session, auth_subject
        )

        assert result is not None
        record, token = result
        assert record.email == "fresh@example.com"
        assert record.user_id == auth_subject.subject.id
        assert token.startswith(TOKEN_PREFIX)
        assert record.token_hash == get_token_hash(token, secret=settings.SECRET)
        mock_enqueue_email.assert_not_called()

    @pytest.mark.auth
    async def test_email_taken_by_other_user(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_second: User,
        mock_enqueue_email: MagicMock,
    ) -> None:
        result = await email_update_service.request_email_update(
            user_second.email, session, auth_subject
        )

        assert result is None
        statement = select(EmailVerification).where(
            EmailVerification.user_id == auth_subject.subject.id
        )
        records = (await session.execute(statement)).scalars().all()
        assert len(records) == 0
        mock_enqueue_email.assert_called_once()
        email, kwargs = (
            mock_enqueue_email.call_args.args[0],
            mock_enqueue_email.call_args.kwargs,
        )
        assert isinstance(email, EmailUpdateAlreadyRegisteredEmail)
        assert kwargs["to_email_addr"] == user_second.email

    @pytest.mark.auth
    async def test_email_taken_case_insensitive(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_second: User,
        mock_enqueue_email: MagicMock,
    ) -> None:
        result = await email_update_service.request_email_update(
            user_second.email.upper(), session, auth_subject
        )

        assert result is None
        mock_enqueue_email.assert_called_once()

    @pytest.mark.auth
    async def test_own_email(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        mock_enqueue_email: MagicMock,
    ) -> None:
        result = await email_update_service.request_email_update(
            auth_subject.subject.email, session, auth_subject
        )

        assert result is not None
        record, _ = result
        assert record.email == auth_subject.subject.email
        mock_enqueue_email.assert_not_called()


@pytest.mark.asyncio
class TestVerify:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        record, token = await _create_verification(save_fixture, user)

        verified_user = await email_update_service.verify(session, token, user)

        assert verified_user.email == "new@example.com"
        statement = select(EmailVerification).where(EmailVerification.id == record.id)
        assert (await session.execute(statement)).scalar_one_or_none() is None

    async def test_email_taken_in_between(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        user_second: User,
    ) -> None:
        old_email = user.email
        record, token = await _create_verification(save_fixture, user)
        user_second.email = record.email
        await save_fixture(user_second)

        with pytest.raises(EmailAlreadyInUse):
            await email_update_service.verify(session, token, user)

        assert user.email == old_email
        statement = select(EmailVerification).where(EmailVerification.id == record.id)
        assert (await session.execute(statement)).scalar_one_or_none() is not None

        with pytest.raises(EmailAlreadyInUse):
            await email_update_service.verify(session, token, user)

    async def test_wrong_user(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        user_second: User,
    ) -> None:
        _, token = await _create_verification(save_fixture, user_second)

        with pytest.raises(InvalidEmailUpdate):
            await email_update_service.verify(session, token, user)

    async def test_expired_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        record, token = await _create_verification(save_fixture, user)
        record.expires_at = utc_now() - timedelta(minutes=1)
        await save_fixture(record)

        with pytest.raises(InvalidEmailUpdate):
            await email_update_service.verify(session, token, user)

    async def test_invalid_token(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        with pytest.raises(InvalidEmailUpdate):
            await email_update_service.verify(session, "polar_ev_bogus", user)
