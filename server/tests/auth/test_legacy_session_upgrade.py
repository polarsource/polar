"""Test that the auth middleware upgrades legacy web sessions."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from polar.auth.middlewares import get_auth_subject
from polar.auth.scope import Scope
from polar.models import User, UserSession


@pytest.fixture
def mock_request() -> MagicMock:
    """Request with no bearer token (cookie-based session)."""
    request = MagicMock()
    request.headers = {}
    return request


@pytest.fixture
def mock_db_session() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def user() -> MagicMock:
    return MagicMock(spec=User)


def _make_user_session(user: MagicMock, scopes: set[Scope]) -> MagicMock:
    session = MagicMock(spec=UserSession)
    session.user = user
    session.scopes = scopes
    return session


@pytest.mark.asyncio
class TestLegacySessionUpgrade:
    @patch("polar.auth.middlewares.get_user_session")
    async def test_legacy_session_upgraded_to_all_scopes(
        self,
        mock_get_user_session: AsyncMock,
        mock_request: MagicMock,
        mock_db_session: AsyncMock,
        user: MagicMock,
    ) -> None:
        """Sessions with exactly {web_read, web_write} get all scopes."""
        mock_get_user_session.return_value = _make_user_session(
            user, {Scope.web_read, Scope.web_write}
        )

        auth_subject = await get_auth_subject(mock_request, mock_db_session)

        assert auth_subject.subject is user
        assert auth_subject.scopes == set(Scope)

    @patch("polar.auth.middlewares.get_user_session")
    async def test_modern_session_not_modified(
        self,
        mock_get_user_session: AsyncMock,
        mock_request: MagicMock,
        mock_db_session: AsyncMock,
        user: MagicMock,
    ) -> None:
        """Sessions with all scopes pass through unchanged."""
        mock_get_user_session.return_value = _make_user_session(user, set(Scope))

        auth_subject = await get_auth_subject(mock_request, mock_db_session)

        assert auth_subject.scopes == set(Scope)

    @patch("polar.auth.middlewares.get_user_session")
    async def test_read_only_impersonation_not_upgraded(
        self,
        mock_get_user_session: AsyncMock,
        mock_request: MagicMock,
        mock_db_session: AsyncMock,
        user: MagicMock,
    ) -> None:
        """Read-only impersonation sessions must NOT be upgraded."""
        mock_get_user_session.return_value = _make_user_session(user, {Scope.web_read})

        auth_subject = await get_auth_subject(mock_request, mock_db_session)

        assert auth_subject.scopes == {Scope.web_read}

    @patch("polar.auth.middlewares.get_user_session")
    async def test_partial_scopes_not_upgraded(
        self,
        mock_get_user_session: AsyncMock,
        mock_request: MagicMock,
        mock_db_session: AsyncMock,
        user: MagicMock,
    ) -> None:
        """Sessions with web scopes plus other scopes are not upgraded."""
        scopes = {Scope.web_read, Scope.web_write, Scope.products_read}
        mock_get_user_session.return_value = _make_user_session(user, scopes)

        auth_subject = await get_auth_subject(mock_request, mock_db_session)

        assert auth_subject.scopes == scopes
