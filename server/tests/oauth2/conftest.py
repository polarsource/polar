"""
🚨 The following fixtures are intended to test OAuth2 features.

It's a bit tricky since we need to handle a synchronous database session.

Bear in mind that there are lot of gotchas, especially if you try to rely on a DB
state that's managed by the async database session.
"""

import os
from collections.abc import Iterator

import pytest

from polar.app import app
from polar.auth.dependencies import Auth
from polar.authz.scope import SCOPES_SUPPORTED, Scope
from polar.authz.service import ScopedSubject
from polar.kit.db.postgres import Engine, Session
from polar.models import Model, User
from polar.oauth2.authorization_server import AuthorizationServer
from polar.oauth2.dependencies import get_authorization_server
from polar.postgres import create_sync_engine
from tests.fixtures.database import SaveFixture


@pytest.fixture(scope="package", autouse=True)
def authlib_insecure_transport() -> None:
    os.environ["AUTHLIB_INSECURE_TRANSPORT"] = "true"


@pytest.fixture(scope="package")
def sync_engine() -> Iterator[Engine]:
    engine = create_sync_engine("app")
    yield engine
    engine.dispose()


@pytest.fixture
def sync_session(sync_engine: Engine) -> Iterator[Session]:
    connection = sync_engine.connect()
    transaction = connection.begin()

    session = Session(bind=connection, expire_on_commit=False)

    yield session

    transaction.rollback()
    connection.close()


@pytest.fixture
def save_fixture(sync_session: Session) -> SaveFixture:
    """
    Override locally save_fixture to use the synchronous session.

    This is necessary because the OAuth2 features rely on the synchronous session.

    🚨 As such, objects won't be present in the async session. Code that works with
    the async session won't be able to see the objects saved by this fixture.

    🧠 You might be tempted to save the object in the async session as well.
    This **won't** work. Underneath, there are two different connections
    and transactions to the database; so you'll end up with conflicts or locks.
    😢 Time lost on this: 4 hours.
    """

    async def _save_fixture(model: Model) -> None:
        sync_session.add(model)
        sync_session.flush()
        sync_session.expunge(model)

    return _save_fixture


@pytest.fixture(autouse=True)
def override_get_authorization_server(sync_session: Session) -> Iterator[None]:
    authorization_server = AuthorizationServer.build(
        sync_session, scopes_supported=SCOPES_SUPPORTED
    )
    app.dependency_overrides[get_authorization_server] = lambda: authorization_server
    yield
    app.dependency_overrides.pop(get_authorization_server)


@pytest.fixture(autouse=True)
def override_current_user(request: pytest.FixtureRequest, user: User) -> Iterator[None]:
    """
    Special fixture to authenticate a user during OAuth2 tests.

    We can't rely on the usual tools since the user is not present in the async session,
    so we need to override the full Auth dependency.
    """
    override_current_user_marker = request.node.get_closest_marker(
        "override_current_user"
    )
    if override_current_user_marker is not None:
        auth = Auth(
            scoped_subject=ScopedSubject(subject=user, scopes=[Scope.web_default]),
            auth_method=None,
        )
        app.dependency_overrides[Auth.current_user] = lambda: auth
        app.dependency_overrides[Auth.optional_user] = lambda: auth

    yield

    app.dependency_overrides.pop(Auth.current_user, None)
    app.dependency_overrides.pop(Auth.optional_user, None)
