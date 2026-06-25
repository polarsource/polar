import time

import pytest
from starlette.requests import Request

from polar.auth.middlewares import get_auth_subject
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.models import OAuth2Token, Organization, User, UserOrganization
from polar.models.oauth2_token_organization import OAuth2TokenOrganization
from polar.models.user_session_organization import UserSessionOrganization
from polar.oauth2.constants import ACCESS_TOKEN_PREFIX
from polar.oauth2.sub_type import SubType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


def _request_with_session_cookie(token: str) -> Request:
    cookie = f"{settings.USER_SESSION_COOKIE_KEY}={token}".encode()
    return Request({"type": "http", "headers": [(b"cookie", cookie)]})


def _request_with_bearer_token(token: str) -> Request:
    header = f"Bearer {token}".encode()
    return Request({"type": "http", "headers": [(b"authorization", header)]})


async def _create_oauth2_token(
    save_fixture: SaveFixture,
    access_token: str,
    *,
    user: User | None = None,
    organization: Organization | None = None,
) -> OAuth2Token:
    token = OAuth2Token(
        client_id="polar_ci_test",
        token_type="bearer",
        access_token=get_token_hash(access_token, secret=settings.SECRET),
        scope="",
        issued_at=int(time.time()),
        expires_in=3600,
    )
    if user is not None:
        token.user_id = user.id
        token.sub_type = SubType.user
    if organization is not None:
        token.organization_id = organization.id
        token.sub_type = SubType.organization
    await save_fixture(token)
    return token


@pytest.mark.asyncio
class TestGetAuthSubjectUserSessionScope:
    async def test_unscoped_session_is_unrestricted(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        token, _ = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=[]
        )

        auth_subject = await get_auth_subject(
            _request_with_session_cookie(token), session
        )

        assert auth_subject.subject == user
        assert auth_subject.organization_ids is None

    async def test_scoped_session_populates_organization_ids(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        token, user_session = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=[]
        )
        await save_fixture(
            UserSessionOrganization(
                user_session_id=user_session.id, organization_id=organization.id
            )
        )
        auth_subject = await get_auth_subject(
            _request_with_session_cookie(token), session
        )

        assert auth_subject.organization_ids == frozenset({organization.id})


@pytest.mark.asyncio
class TestGetAuthSubjectOAuth2TokenScope:
    async def test_unscoped_user_token_is_unrestricted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        await _create_oauth2_token(save_fixture, access_token, user=user)

        auth_subject = await get_auth_subject(
            _request_with_bearer_token(access_token), session
        )

        assert auth_subject.subject == user
        assert auth_subject.organization_ids is None

    async def test_scoped_user_token_populates_organization_ids(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
    ) -> None:
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        token = await _create_oauth2_token(save_fixture, access_token, user=user)
        await save_fixture(
            OAuth2TokenOrganization(
                oauth2_token_id=token.id, organization_id=organization.id
            )
        )

        auth_subject = await get_auth_subject(
            _request_with_bearer_token(access_token), session
        )

        assert auth_subject.subject == user
        assert auth_subject.organization_ids == frozenset({organization.id})

    async def test_organization_token_is_unrestricted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.organization]}test"
        await _create_oauth2_token(
            save_fixture, access_token, organization=organization
        )

        auth_subject = await get_auth_subject(
            _request_with_bearer_token(access_token), session
        )

        assert auth_subject.subject == organization
        assert auth_subject.organization_ids is None
