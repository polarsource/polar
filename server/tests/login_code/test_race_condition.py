import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import DBAPIError

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.login_code.repository import LoginCodeRepository
from polar.login_code.service import LoginCodeInvalidOrExpired
from polar.login_code.service import login_code as login_code_service
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestAuthenticateConcurrency:
    async def test_lock_not_available_raises_invalid_or_expired(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        _, code = await login_code_service.request(session, email="race@example.com")
        await session.flush()

        lock_error = DBAPIError(
            "SELECT ...", {}, Exception("could not obtain lock on row")
        )
        mocker.patch.object(
            LoginCodeRepository,
            "get_by_code_for_update",
            side_effect=lock_error,
        )

        with pytest.raises(LoginCodeInvalidOrExpired):
            await login_code_service.authenticate(
                session,
                code=code,
                email="race@example.com",
            )

    async def test_unrelated_dbapi_error_is_reraised(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        _, code = await login_code_service.request(session, email="race@example.com")
        await session.flush()

        other_error = DBAPIError(
            "SELECT ...", {}, Exception("some other database failure")
        )
        mocker.patch.object(
            LoginCodeRepository,
            "get_by_code_for_update",
            side_effect=other_error,
        )

        with pytest.raises(DBAPIError):
            await login_code_service.authenticate(
                session,
                code=code,
                email="race@example.com",
            )

    async def test_code_is_single_use(
        self,
        session: AsyncSession,
    ) -> None:
        email = "single-use@example.com"
        _, code = await login_code_service.request(session, email=email)
        await session.flush()

        user, _ = await login_code_service.authenticate(session, code=code, email=email)
        assert user.email == email

        with pytest.raises(LoginCodeInvalidOrExpired):
            await login_code_service.authenticate(session, code=code, email=email)

    async def test_for_update_method_is_called(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        email = "lock-acquired@example.com"
        _, code = await login_code_service.request(session, email=email)
        await session.flush()

        spy = mocker.spy(LoginCodeRepository, "get_by_code_for_update")

        await login_code_service.authenticate(session, code=code, email=email)

        spy.assert_called_once()
        code_hash = get_token_hash(code, secret=settings.SECRET)
        assert spy.call_args.args[1] == code_hash
        assert spy.call_args.args[2] == email
