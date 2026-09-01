import pytest
from pytest_mock import MockerFixture
from starlette.requests import Request

from polar.auth.authentication_session import (
    AuthenticationSessionService,
    get_optional_authentication_session,
)
from polar.config import settings
from polar.models import AuthenticationSession
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestUpdate:
    async def test_persists_context(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        authentication_session = AuthenticationSession(
            token_hash="a" * 64,
            expires_at=9999999999,
            step=0,
            authentication_method_references=[],
            used_factors=[],
            context=None,
            identity_id=None,
        )
        await save_fixture(authentication_session)

        service = AuthenticationSessionService(session, set())
        dataclass = authentication_session.to_dataclass()
        dataclass.context = {"foo": "bar"}

        await service.update(dataclass)
        await session.refresh(authentication_session)

        assert authentication_session.context == {"foo": "bar"}


@pytest.mark.asyncio
class TestGetOptionalAuthenticationSession:
    async def test_non_ascii_cookie_returns_none(
        self, session: AsyncSession, mocker: MockerFixture
    ) -> None:
        cookie = f"{settings.AUTHENTICATION_SESSION_COOKIE_KEY}=token-中文".encode()
        request = Request({"type": "http", "headers": [(b"cookie", cookie)]})
        service = AuthenticationSessionService(session, set())
        get_by_token_mock = mocker.patch.object(service, "get_by_token")

        result = await get_optional_authentication_session(request, service)

        assert result is None
        get_by_token_mock.assert_not_called()
