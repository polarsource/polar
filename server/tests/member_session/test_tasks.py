import contextlib
from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.member_session.service import member_session
from polar.member_session.tasks import member_session_delete_expired
from polar.models import Member, Organization
from polar.models.member import MemberRole
from polar.models.member_session import MemberSession
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


@pytest.mark.asyncio
class TestMemberSessionDeleteExpired:
    async def test_deletes_expired_sessions(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            name="Test Member",
            role=MemberRole.owner,
        )
        await save_fixture(member)

        expired_session = MemberSession(
            token="expired_token_hash",
            member_id=member.id,
            expires_at=utc_now() - timedelta(hours=1),
        )
        await save_fixture(expired_session)

        valid_token, _ = await member_session.create_member_session(session, member)
        await session.commit()

        mocker.patch(
            "polar.member_session.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await member_session_delete_expired()

        result = await member_session.get_by_token(session, valid_token)
        assert result is not None

        result = await member_session.get_by_token(
            session, "expired_token_hash", expired=True
        )
        assert result is None
