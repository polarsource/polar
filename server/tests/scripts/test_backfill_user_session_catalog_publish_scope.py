from datetime import timedelta

import pytest

from polar.auth.scope import READ_ONLY_SCOPES, Scope
from polar.kit.crypto import generate_token, get_token_hash
from polar.kit.utils import utc_now
from polar.models import User, UserSession
from polar.postgres import AsyncSession
from scripts.backfill_user_session_catalog_publish_scope import backfill_statement
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture


@pytest.mark.anyio
class TestBackfillUserSessionCatalogPublishScope:
    async def test_grants_writable_live_sessions(
        self, session: AsyncSession, save_fixture: SaveFixture, user: User
    ) -> None:
        full_scopes = set(Scope) - {Scope.catalog_publish}
        now = utc_now()
        sessions = {
            name: UserSession(
                token=get_token_hash(generate_token(prefix="polar_us_")),
                user_agent="tests",
                user=user,
                scopes=scopes,
                expires_at=expires_at,
            )
            for name, scopes, expires_at in (
                ("dashboard", full_scopes, now + timedelta(days=1)),
                ("impersonation", READ_ONLY_SCOPES, now + timedelta(days=1)),
                ("expired", full_scopes, now - timedelta(days=1)),
                ("current", set(Scope), now + timedelta(days=1)),
            )
        }
        for user_session in sessions.values():
            await save_fixture(user_session)

        updated = await run_batched_update(
            backfill_statement(), batch_size=1, sleep_seconds=0, session=session
        )

        assert updated == 1
        for user_session in sessions.values():
            await session.refresh(user_session)
        assert {
            name: Scope.catalog_publish in user_session.scopes
            for name, user_session in sessions.items()
        } == {
            "dashboard": True,
            "impersonation": False,
            "expired": False,
            "current": True,
        }
        assert sorted(sessions["current"].scopes) == sorted(Scope)
