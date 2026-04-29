"""Unit tests for the user-personal authorization dependencies.

These directly exercise the ``WebUserAuthorizer`` factory contract, so a
missing or wrong ``required_scopes`` declaration on a typed alias is caught
without needing per-endpoint integration tests.
"""

from unittest.mock import MagicMock

import pytest

from polar.auth.models import AuthSubject
from polar.auth.scope import READ_ONLY_SCOPES, Scope
from polar.authz.dependencies import WebUserAuthorizer
from polar.models import User, UserSession
from polar.oauth2.exceptions import InsufficientScopeError


def _auth_subject(scopes: set[Scope]) -> AuthSubject[User]:
    user = MagicMock(spec=User)
    session = MagicMock(spec=UserSession)
    return AuthSubject(user, scopes, session)


@pytest.mark.asyncio
class TestWebUserAuthorizer:
    async def test_passes_when_required_scope_present(self) -> None:
        dependency = WebUserAuthorizer({Scope.user_write})
        auth_subject = _auth_subject({Scope.user_write})

        result = await dependency(auth_subject=auth_subject)

        assert result is auth_subject

    @pytest.mark.parametrize(
        "scopes",
        [
            {Scope.user_read},
            {Scope.user_write},
            {Scope.user_read, Scope.user_write},
        ],
    )
    async def test_read_alias_accepts_either_read_or_write(
        self, scopes: set[Scope]
    ) -> None:
        """Read aliases declare ``{X_read, X_write}`` so write implies read."""
        dependency = WebUserAuthorizer({Scope.user_read, Scope.user_write})
        auth_subject = _auth_subject(scopes)

        result = await dependency(auth_subject=auth_subject)

        assert result is auth_subject

    async def test_passes_with_extra_unrelated_scopes(self) -> None:
        dependency = WebUserAuthorizer({Scope.user_write})
        auth_subject = _auth_subject({Scope.user_write, Scope.products_read})

        result = await dependency(auth_subject=auth_subject)

        assert result is auth_subject

    async def test_raises_when_only_unrelated_scopes_present(self) -> None:
        dependency = WebUserAuthorizer({Scope.user_write})
        auth_subject = _auth_subject({Scope.products_read})

        with pytest.raises(InsufficientScopeError):
            await dependency(auth_subject=auth_subject)

    async def test_raises_with_empty_scopes(self) -> None:
        dependency = WebUserAuthorizer({Scope.user_write})
        auth_subject = _auth_subject(set())

        with pytest.raises(InsufficientScopeError):
            await dependency(auth_subject=auth_subject)

    async def test_write_alias_rejects_read_only_scope(self) -> None:
        """A subject with only ``user_read`` cannot satisfy a ``user_write``
        requirement."""
        dependency = WebUserAuthorizer({Scope.user_write})
        auth_subject = _auth_subject({Scope.user_read})

        with pytest.raises(InsufficientScopeError):
            await dependency(auth_subject=auth_subject)


@pytest.mark.asyncio
class TestImpersonationContract:
    """Verify the system invariant that ``READ_ONLY_SCOPES`` (the scope set
    given to backoffice impersonation sessions) is read-able everywhere but
    write-blocked everywhere."""

    @pytest.mark.parametrize(
        "required_scopes",
        [
            {Scope.user_read, Scope.user_write},
            {Scope.payouts_read, Scope.payouts_write},
        ],
    )
    async def test_impersonation_accepted_for_reads(
        self, required_scopes: set[Scope]
    ) -> None:
        dependency = WebUserAuthorizer(required_scopes)
        auth_subject = _auth_subject(READ_ONLY_SCOPES)

        result = await dependency(auth_subject=auth_subject)

        assert result is auth_subject

    @pytest.mark.parametrize(
        "required_scopes",
        [
            {Scope.user_write},
            {Scope.payouts_write},
        ],
    )
    async def test_impersonation_rejected_from_writes(
        self, required_scopes: set[Scope]
    ) -> None:
        dependency = WebUserAuthorizer(required_scopes)
        auth_subject = _auth_subject(READ_ONLY_SCOPES)

        with pytest.raises(InsufficientScopeError):
            await dependency(auth_subject=auth_subject)

    async def test_read_only_scopes_contains_no_write_scopes(self) -> None:
        """Sanity check: the impersonation read-only invariant rests on
        ``READ_ONLY_SCOPES`` containing no ``_write`` scopes. If a future
        scope addition violates this, every user-personal write endpoint
        would silently become reachable by impersonation."""
        write_scopes = {s for s in READ_ONLY_SCOPES if s.value.endswith(":write")}
        assert write_scopes == set()
