import pytest

from polar.auth.authentication_session import AuthenticationSessionService
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
