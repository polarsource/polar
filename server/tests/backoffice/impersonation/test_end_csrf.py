from collections.abc import AsyncGenerator
from dataclasses import dataclass
from datetime import timedelta

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select

from polar.auth.scope import READ_ONLY_SCOPES
from polar.backoffice import app as backoffice_app
from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair
from polar.kit.utils import utc_now
from polar.models import Organization, User, UserSession, UserSessionOrganization
from polar.postgres import AsyncSession, get_db_session
from tests.fixtures.database import SaveFixture


@dataclass
class ImpersonationState:
    admin: User
    admin_token: str
    admin_hash: str
    impersonated: User
    imp_token: str
    imp_hash: str
    organization: Organization


@pytest_asyncio.fixture
async def csrf_backoffice_client(
    session: AsyncSession,
) -> AsyncGenerator[httpx.AsyncClient]:
    # Override ONLY get_db_session so the endpoint uses the test transaction.
    # Crucially, get_admin is NOT overridden: the real global auth dependency
    # runs, which is the boundary the cross-site request must cross.
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)


@pytest_asyncio.fixture
async def impersonation_state(
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
) -> ImpersonationState:
    admin = User(
        email="admin@example.com",
        email_verified=True,
        avatar_url="https://example.com/a.png",
        oauth_accounts=[],
        is_admin=True,
    )
    impersonated = User(
        email="victim@example.com",
        email_verified=True,
        avatar_url="https://example.com/v.png",
        oauth_accounts=[],
    )
    await save_fixture(admin)
    await save_fixture(impersonated)

    admin_token, admin_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix="polar_us_"
    )
    imp_token, imp_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix="polar_us_"
    )

    admin_row = UserSession(
        token=admin_hash,
        user_agent="tests",
        user=admin,
        expires_at=utc_now() + timedelta(days=1),
        scopes=list(READ_ONLY_SCOPES),
    )
    imp_row = UserSession(
        token=imp_hash,
        user_agent="tests",
        user=impersonated,
        expires_at=utc_now() + timedelta(minutes=30),
        scopes=list(READ_ONLY_SCOPES),
    )
    # Impersonation sessions are scoped to a single organization; this also
    # exercises the org-scoped redirect branch of end_impersonation.
    imp_row.organization_scopes = [
        UserSessionOrganization(organization_id=organization.id)
    ]
    session.add(admin_row)
    session.add(imp_row)
    await session.flush()

    return ImpersonationState(
        admin=admin,
        admin_token=admin_token,
        admin_hash=admin_hash,
        impersonated=impersonated,
        imp_token=imp_token,
        imp_hash=imp_hash,
        organization=organization,
    )


@pytest.mark.asyncio
class TestEndImpersonationCSRF:
    """Regression coverage for the /impersonation/end CSRF.

    The endpoint mutates state (deletes the in-flight UserSession, rewrites the
    auth cookies) so it must not be reachable via a cross-site top-level GET,
    which is the one request shape that SameSite=Lax cookies are still sent on.
    Switching the route to POST restores the SameSite=Lax-on-POST CSRF defense
    used by every other backoffice mutation.
    """

    async def test_post_end_impersonation_restores_admin_session(
        self,
        session: AsyncSession,
        csrf_backoffice_client: httpx.AsyncClient,
        impersonation_state: ImpersonationState,
    ) -> None:
        # A same-origin form POST is the legitimate "Exit impersonation" action;
        # it carries the SameSite=Lax cookies normally and is authorized by
        # the real get_admin boundary.
        response = await csrf_backoffice_client.post(
            "/impersonation/end",
            cookies={
                settings.IMPERSONATION_COOKIE_KEY: impersonation_state.admin_token,
                settings.USER_SESSION_COOKIE_KEY: impersonation_state.imp_token,
            },
            follow_redirects=False,
        )

        # Post/Redirect/Get: 303 See Other so the browser follows with a GET.
        assert response.status_code == 303

        result = await session.execute(
            select(UserSession).where(UserSession.token == impersonation_state.imp_hash)
        )
        assert result.unique().scalar_one_or_none() is None

        result = await session.execute(
            select(UserSession).where(
                UserSession.token == impersonation_state.admin_hash
            )
        )
        assert result.unique().scalar_one_or_none() is not None

        # The admin is bounced back to the backoffice page for the org that
        # was being impersonated.
        assert str(impersonation_state.organization.id) in response.headers["location"]

        # delete_cookie emits a Set-Cookie with Max-Age=0 / expired Expires.
        set_cookies = "\n".join(response.headers.get_list("set-cookie"))
        assert settings.USER_SESSION_COOKIE_KEY in set_cookies
        assert impersonation_state.admin_token in set_cookies
        assert settings.IMPERSONATION_COOKIE_KEY in set_cookies
        assert settings.IMPERSONATION_INDICATOR_COOKIE_KEY in set_cookies

    async def test_get_end_impersonation_is_rejected(
        self,
        session: AsyncSession,
        csrf_backoffice_client: httpx.AsyncClient,
        impersonation_state: ImpersonationState,
    ) -> None:
        # This is the server-side shape an attacker's cross-site top-level
        # navigation produces: a bare cookies-only GET, no CSRF token, no
        # Origin/Sec-Fetch-Site/Referer header. After the fix the route is
        # POST-only, so the GET is rejected with 405 and no state mutates.
        response = await csrf_backoffice_client.get(
            "/impersonation/end",
            cookies={
                settings.IMPERSONATION_COOKIE_KEY: impersonation_state.admin_token,
                settings.USER_SESSION_COOKIE_KEY: impersonation_state.imp_token,
            },
            follow_redirects=False,
        )

        assert response.status_code == 405
        assert response.headers.get("allow") == "POST"

        result = await session.execute(
            select(UserSession).where(UserSession.token == impersonation_state.imp_hash)
        )
        assert result.unique().scalar_one_or_none() is not None

        result = await session.execute(
            select(UserSession).where(
                UserSession.token == impersonation_state.admin_hash
            )
        )
        assert result.unique().scalar_one_or_none() is not None

    async def test_post_without_auth_cookies_is_rejected(
        self,
        session: AsyncSession,
        csrf_backoffice_client: httpx.AsyncClient,
        impersonation_state: ImpersonationState,
    ) -> None:
        # A cross-site form POST does not carry SameSite=Lax cookies, so it
        # arrives with no credentials and the real get_admin rejects it before
        # any state mutation runs.
        response = await csrf_backoffice_client.post(
            "/impersonation/end",
            follow_redirects=False,
        )

        assert response.status_code == 401

        result = await session.execute(
            select(UserSession).where(UserSession.token == impersonation_state.imp_hash)
        )
        assert result.unique().scalar_one_or_none() is not None
        result = await session.execute(
            select(UserSession).where(
                UserSession.token == impersonation_state.admin_hash
            )
        )
        assert result.unique().scalar_one_or_none() is not None
