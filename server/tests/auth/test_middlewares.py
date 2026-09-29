import json
import time
from datetime import timedelta
from uuid import UUID

import pytest
from starlette.requests import Request
from starlette.types import Message, Receive, Scope, Send

from polar.auth.exceptions import (
    InvalidRequestedOrganization,
    RequestedOrganizationNotAccessible,
)
from polar.auth.middlewares import AuthSubjectMiddleware, get_auth_subject
from polar.auth.models import ORGANIZATION_HEADER
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import (
    OAuth2Client,
    OAuth2Token,
    Organization,
    PersonalAccessToken,
    User,
    UserOrganization,
)
from polar.models.oauth2_token_organization import OAuth2TokenOrganization
from polar.models.user_session_organization import UserSessionOrganization
from polar.oauth2.constants import ACCESS_TOKEN_PREFIX
from polar.oauth2.sub_type import SubType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture


def _request(
    headers: list[tuple[bytes, bytes]], requested_organization: str | UUID | None
) -> Request:
    if requested_organization is not None:
        headers.append(
            (ORGANIZATION_HEADER.lower().encode(), str(requested_organization).encode())
        )
    return Request({"type": "http", "headers": headers})


def _request_with_session_cookie(
    token: str, *, requested_organization: str | UUID | None = None
) -> Request:
    cookie = f"{settings.USER_SESSION_COOKIE_KEY}={token}".encode()
    return _request([(b"cookie", cookie)], requested_organization)


def _request_with_bearer_token(
    token: str, *, requested_organization: str | UUID | None = None
) -> Request:
    header = f"Bearer {token}".encode()
    return _request([(b"authorization", header)], requested_organization)


def _request_without_credentials(requested_organization: UUID) -> Request:
    return _request([], requested_organization)


async def _create_oauth2_token(
    save_fixture: SaveFixture,
    access_token: str,
    *,
    user: User | None = None,
    organization: Organization | None = None,
) -> OAuth2Token:
    client = OAuth2Client(client_id="polar_ci_test")
    await save_fixture(client)
    token = OAuth2Token(
        client_id=client.client_id,
        token_type="bearer",
        access_token=get_token_hash(access_token),
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


@pytest.mark.asyncio
class TestGetAuthSubjectRequestedOrganization:
    async def test_user_token_narrows_to_requested_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        await _create_oauth2_token(save_fixture, access_token, user=user)

        auth_subject = await get_auth_subject(
            _request_with_bearer_token(
                access_token, requested_organization=organization.id
            ),
            session,
        )

        assert auth_subject.organization_ids == frozenset({organization.id})

    async def test_user_token_non_member_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization_second: Organization,
    ) -> None:
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        await _create_oauth2_token(save_fixture, access_token, user=user)

        with pytest.raises(RequestedOrganizationNotAccessible):
            await get_auth_subject(
                _request_with_bearer_token(
                    access_token, requested_organization=organization_second.id
                ),
                session,
            )

    async def test_unrestricted_user_token_sso_enforced_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.sso_enforced = True
        await save_fixture(organization)
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        await _create_oauth2_token(save_fixture, access_token, user=user)

        with pytest.raises(RequestedOrganizationNotAccessible):
            await get_auth_subject(
                _request_with_bearer_token(
                    access_token, requested_organization=organization.id
                ),
                session,
            )

    async def test_user_token_narrows_down_scope(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await save_fixture(
            UserOrganization(user=user, organization=organization_second)
        )
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        token = await _create_oauth2_token(save_fixture, access_token, user=user)
        for scoped_organization in (organization, organization_second):
            await save_fixture(
                OAuth2TokenOrganization(
                    oauth2_token_id=token.id, organization_id=scoped_organization.id
                )
            )

        auth_subject = await get_auth_subject(
            _request_with_bearer_token(
                access_token, requested_organization=organization_second.id
            ),
            session,
        )

        assert auth_subject.organization_ids == frozenset({organization_second.id})

    async def test_user_token_organization_outside_down_scope(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await save_fixture(
            UserOrganization(user=user, organization=organization_second)
        )
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        token = await _create_oauth2_token(save_fixture, access_token, user=user)
        await save_fixture(
            OAuth2TokenOrganization(
                oauth2_token_id=token.id, organization_id=organization.id
            )
        )

        with pytest.raises(RequestedOrganizationNotAccessible):
            await get_auth_subject(
                _request_with_bearer_token(
                    access_token, requested_organization=organization_second.id
                ),
                session,
            )

    async def test_personal_access_token_narrows_to_requested_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        access_token = "polar_pat_test"
        await save_fixture(
            PersonalAccessToken(
                comment="test",
                token=get_token_hash(access_token),
                user=user,
                expires_at=utc_now() + timedelta(days=1),
                scope="",
            )
        )

        auth_subject = await get_auth_subject(
            _request_with_bearer_token(
                access_token, requested_organization=organization.id
            ),
            session,
        )

        assert auth_subject.organization_ids == frozenset({organization.id})

    async def test_organization_token_own_organization(
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
            _request_with_bearer_token(
                access_token, requested_organization=organization.id
            ),
            session,
        )

        assert auth_subject.subject == organization

    async def test_organization_token_other_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.organization]}test"
        await _create_oauth2_token(
            save_fixture, access_token, organization=organization
        )

        with pytest.raises(RequestedOrganizationNotAccessible):
            await get_auth_subject(
                _request_with_bearer_token(
                    access_token, requested_organization=organization_second.id
                ),
                session,
            )

    async def test_user_session_narrows_to_requested_organization(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        token, user_session = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=[]
        )

        auth_subject = await get_auth_subject(
            _request_with_session_cookie(token, requested_organization=organization.id),
            session,
        )

        assert auth_subject.organization_ids == frozenset({organization.id})
        assert user_session.organization_scopes == []

    async def test_unrestricted_user_session_sso_enforced_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.sso_enforced = True
        await save_fixture(organization)
        token, _ = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=[]
        )

        with pytest.raises(RequestedOrganizationNotAccessible):
            await get_auth_subject(
                _request_with_session_cookie(
                    token, requested_organization=organization.id
                ),
                session,
            )

    async def test_user_session_organization_outside_down_scope(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await save_fixture(
            UserOrganization(user=user, organization=organization_second)
        )
        token, _ = await auth_service._create_user_session(
            session,
            user,
            user_agent="test",
            scopes=[],
            organization_ids=frozenset({organization.id}),
        )

        with pytest.raises(RequestedOrganizationNotAccessible):
            await get_auth_subject(
                _request_with_session_cookie(
                    token, requested_organization=organization_second.id
                ),
                session,
            )

    async def test_sso_session_can_select_its_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.sso_enforced = True
        await save_fixture(organization)
        token, _ = await auth_service._create_user_session(
            session,
            user,
            user_agent="test",
            scopes=[],
            organization_ids=frozenset({organization.id}),
        )

        auth_subject = await get_auth_subject(
            _request_with_session_cookie(token, requested_organization=organization.id),
            session,
        )

        assert auth_subject.organization_ids == frozenset({organization.id})

    async def test_malformed_organization_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        await _create_oauth2_token(save_fixture, access_token, user=user)

        with pytest.raises(InvalidRequestedOrganization):
            await get_auth_subject(
                _request_with_bearer_token(access_token, requested_organization="acme"),
                session,
            )

    async def test_anonymous_ignores_header(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        auth_subject = await get_auth_subject(
            _request_without_credentials(organization.id), session
        )

        assert auth_subject.organization_ids is None


@pytest.mark.asyncio
class TestAuthSubjectMiddlewareRequestedOrganization:
    async def test_inaccessible_organization_returns_403(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        user: User,
        organization_second: Organization,
    ) -> None:
        access_token = f"{ACCESS_TOKEN_PREFIX[SubType.user]}test"
        await _create_oauth2_token(save_fixture, access_token, user=user)

        async def app(scope: Scope, receive: Receive, send: Send) -> None:
            raise AssertionError("The request should not reach the app")

        messages: list[Message] = []

        async def send(message: Message) -> None:
            messages.append(message)

        async def receive() -> Message:
            return {"type": "http.request", "body": b""}

        request = _request_with_bearer_token(
            access_token, requested_organization=organization_second.id
        )
        await AuthSubjectMiddleware(app, redis)(
            {**request.scope, "state": {"async_session": session}}, receive, send
        )

        assert messages[0]["status"] == 403
        assert json.loads(messages[1]["body"])["error"] == (
            "RequestedOrganizationNotAccessible"
        )
