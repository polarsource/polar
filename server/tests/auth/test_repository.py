from datetime import timedelta

import pytest

from polar.auth.repository import (
    AuthenticationSessionRepository,
    EmailOTPRepository,
    UserSessionRepository,
)
from polar.auth.scope import Scope
from polar.auth.service import USER_SESSION_TOKEN_PREFIX
from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.kit.utils import utc_now
from polar.models import AuthenticationSession, EmailOTP, User, UserSession
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def create_authentication_session(
    save_fixture: SaveFixture,
    *,
    token_hash: str,
    expires_at: int,
) -> AuthenticationSession:
    authentication_session = AuthenticationSession(
        token_hash=token_hash,
        expires_at=expires_at,
        step=0,
        authentication_method_references=[],
        used_factors=[],
        context=None,
        identity_id=None,
    )
    await save_fixture(authentication_session)
    return authentication_session


async def create_email_otp(
    save_fixture: SaveFixture,
    authentication_session: AuthenticationSession,
    *,
    code_hash: str,
    expires_at: int,
) -> EmailOTP:
    email_otp = EmailOTP(
        code_hash=code_hash,
        expires_at=expires_at,
        email="test@example.com",
        identity_id=None,
        authentication_session_id=authentication_session.id,
    )
    await save_fixture(email_otp)
    return email_otp


@pytest.mark.asyncio
class TestEmailOTPRepositoryDeleteExpired:
    async def test_deletes_only_expired(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        authentication_session = await create_authentication_session(
            save_fixture,
            token_hash="a" * 64,
            expires_at=9999999999,
        )

        now = int(utc_now().timestamp())
        expired = await create_email_otp(
            save_fixture,
            authentication_session,
            code_hash="e" * 64,
            expires_at=now - 3600,
        )
        valid = await create_email_otp(
            save_fixture,
            authentication_session,
            code_hash="v" * 64,
            expires_at=now + 3600,
        )

        repository = EmailOTPRepository.from_session(session)
        await repository.delete_expired()

        updated_expired = await repository.get_by_id(expired.id)
        assert updated_expired is None
        updated_valid = await repository.get_by_id(valid.id)
        assert updated_valid is not None


@pytest.mark.asyncio
class TestAuthenticationSessionRepositoryDeleteExpired:
    async def test_deletes_only_expired(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        now = int(utc_now().timestamp())
        expired = await create_authentication_session(
            save_fixture,
            token_hash="e" * 64,
            expires_at=now - 3600,
        )
        valid = await create_authentication_session(
            save_fixture,
            token_hash="v" * 64,
            expires_at=now + 3600,
        )

        repository = AuthenticationSessionRepository.from_session(session)
        await repository.delete_expired()

        updated_expired = await repository.get_by_id(expired.id)
        assert updated_expired is None
        updated_valid = await repository.get_by_id(valid.id)
        assert updated_valid is not None


@pytest.mark.asyncio
class TestUserSessionRepositoryGetByToken:
    async def test_rewrites_a_session_hashed_under_a_retired_secret(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            settings, "HASH_SECRETS", {"k1": "retired", "k2": "current"}
        )
        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k1")
        token = generate_token(prefix=USER_SESSION_TOKEN_PREFIX)
        user_session = UserSession(
            token=get_token_hash(token),
            user_agent="tests",
            user=user,
            scopes=set(Scope),
            expires_at=utc_now() + timedelta(seconds=60),
        )
        await save_fixture(user_session)

        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k2")
        repository = UserSessionRepository.from_session(session)
        found = await repository.get_by_token(token)

        assert found is not None
        assert found.id == user_session.id

        await session.flush()
        await session.refresh(found)
        assert found.token == get_token_hash(token)
