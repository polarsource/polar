import pytest
from httpx2 import AsyncClient

from polar.auth.models import AuthSubject
from polar.member_session.service import member_session as member_session_service
from polar.models import Member
from polar.postgres import AsyncSession
from tests.fixtures.auth import MEMBER_AUTH_SUBJECT


@pytest.mark.anyio
class TestLogout:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/customer-portal/customer-session/logout")
        assert response.status_code == 401

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_expires_session(
        self,
        client: AsyncClient,
        session: AsyncSession,
        auth_subject: AuthSubject[Member],
        member: Member,
    ) -> None:
        token, member_session = await member_session_service.create_member_session(
            session, member
        )
        auth_subject.session = member_session

        response = await client.post("/v1/customer-portal/customer-session/logout")
        assert response.status_code == 204

        assert await member_session_service.get_by_token(session, token) is None
