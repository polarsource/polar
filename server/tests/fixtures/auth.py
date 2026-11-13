from datetime import timedelta
from typing import Any, Literal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from polar.auth.models import Anonymous, AuthSubject, Subject
from polar.auth.scope import UNCLAIMED_AGENT_SCOPES, Scope
from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import (
    BackofficeUser,
    BackofficeUserSession,
    User,
    UserSession,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.fixture
async def backoffice_user(save_fixture: SaveFixture) -> BackofficeUser:
    user = BackofficeUser(email=f"{uuid4()}@example.com")
    await save_fixture(user)
    return user


@pytest.fixture
async def backoffice_user_session(
    save_fixture: SaveFixture, backoffice_user: BackofficeUser
) -> BackofficeUserSession:
    session = BackofficeUserSession(
        token_hash="0" * 64,
        expires_at=utc_now() + settings.BACKOFFICE_USER_SESSION_TTL,
        user=backoffice_user,
    )
    await save_fixture(session)
    return session


def make_session_stale(auth_subject: AuthSubject[User]) -> None:
    assert isinstance(auth_subject.session, UserSession)
    auth_subject.session.created_at = utc_now() - (
        settings.USER_SESSION_FRESHNESS_TTL + timedelta(minutes=1)
    )


class AuthSubjectFixture:
    def __init__(
        self,
        *,
        subject: Literal[
            "anonymous",
            "user",
            "user_second",
            "organization",
            "organization_second",
            "customer",
            "member_owner",
            "member_billing_manager",
            "member",
            "agent",
        ] = "user",
        scopes: set[Scope] | None = None,
    ):
        if scopes is None:
            scopes = set(UNCLAIMED_AGENT_SCOPES if subject == "agent" else Scope)
        self.subject = subject
        self.scopes = scopes

    def __repr__(self) -> str:
        scopes = (
            "{" + ", ".join(repr(scope.value) for scope in sorted(self.scopes)) + "}"
        )
        return f"AuthSubjectFixture(subject={self.subject!r}, scopes={scopes})"


CUSTOMER_AUTH_SUBJECT = AuthSubjectFixture(
    subject="customer", scopes={Scope.customer_portal_read, Scope.customer_portal_write}
)

MEMBER_OWNER_AUTH_SUBJECT = AuthSubjectFixture(
    subject="member_owner",
    scopes={Scope.customer_portal_read, Scope.customer_portal_write},
)

MEMBER_BILLING_MANAGER_AUTH_SUBJECT = AuthSubjectFixture(
    subject="member_billing_manager",
    scopes={Scope.customer_portal_read, Scope.customer_portal_write},
)

MEMBER_AUTH_SUBJECT = AuthSubjectFixture(
    subject="member",
    scopes={Scope.customer_portal_read, Scope.customer_portal_write},
)


@pytest.fixture
def auth_subject(
    request: pytest.FixtureRequest,
    session: AsyncSession,
) -> AuthSubject[Subject]:
    """
    This fixture generates an AuthSubject instance used by the `client` fixture
    to override the FastAPI authentication dependency, but also can be used manually
    if needed.

    Its parameters are generated through the `auth` marker.
    See `pytest_generate_tests` below for more information.
    """
    auth_subject_fixture: AuthSubjectFixture = request.param

    subject: Subject = (
        Anonymous()
        if auth_subject_fixture.subject == "anonymous"
        else request.getfixturevalue(auth_subject_fixture.subject)
    )

    # For User subjects, provide a mock UserSession so is_web_session() returns True.
    # This matches real web session behavior where all User sessions are UserSessions.
    session: Any = None
    if isinstance(subject, User):
        session = MagicMock(spec=UserSession)
        session.created_at = utc_now()

    return AuthSubject(subject, auth_subject_fixture.scopes, session)


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    # The test requests the `auth_subject` fixture
    if "auth_subject" in metafunc.fixturenames:
        pytest_params = []

        # The test is decorated with the `auth` marker
        auth_marker = metafunc.definition.get_closest_marker("auth")
        if auth_marker is not None:
            # No argument: use a default AuthSubjectFixture
            args: tuple[Any] = auth_marker.args
            if len(args) == 0:
                args = (AuthSubjectFixture(),)

            # Generate a test for each AuthSubjectFixture argument
            for arg in args:
                if not isinstance(arg, AuthSubjectFixture):
                    raise ValueError(
                        "auth marker arguments must be "
                        f"of type AuthSubjectFixture, got {type(arg)}"
                    )
                pytest_params.append(pytest.param(arg, id=repr(arg)))
        # Test is not decorated with `auth` marker: consider the user anonymous
        else:
            pytest_params = [
                pytest.param(AuthSubjectFixture(subject="anonymous"), id="anonymous")
            ]
        metafunc.parametrize("auth_subject", pytest_params, indirect=["auth_subject"])
