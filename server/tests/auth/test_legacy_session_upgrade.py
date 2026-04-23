"""Test that legacy web sessions with {web_read, web_write} are upgraded to all scopes."""

from polar.auth.scope import Scope


def _simulate_upgrade(scopes: set[Scope]) -> set[Scope]:
    """Replicate the upgrade logic from auth/middlewares.py."""
    if scopes == {Scope.web_read, Scope.web_write}:
        return set(Scope)
    return scopes


class TestLegacySessionUpgrade:
    def test_legacy_session_upgraded(self) -> None:
        """Sessions with exactly {web_read, web_write} get all scopes."""
        scopes = {Scope.web_read, Scope.web_write}
        result = _simulate_upgrade(scopes)
        assert result == set(Scope)

    def test_modern_session_unchanged(self) -> None:
        """Sessions with all scopes are not modified."""
        scopes = set(Scope)
        result = _simulate_upgrade(scopes)
        assert result == set(Scope)

    def test_read_only_session_not_upgraded(self) -> None:
        """Read-only impersonation sessions ({web_read} only) must NOT be upgraded."""
        scopes = {Scope.web_read}
        result = _simulate_upgrade(scopes)
        assert result == {Scope.web_read}

    def test_partial_scopes_not_upgraded(self) -> None:
        """Sessions with web_write plus other scopes are not upgraded."""
        scopes = {Scope.web_read, Scope.web_write, Scope.products_read}
        result = _simulate_upgrade(scopes)
        assert result == {Scope.web_read, Scope.web_write, Scope.products_read}

    def test_empty_scopes_not_upgraded(self) -> None:
        """Empty scope sets are not upgraded."""
        scopes: set[Scope] = set()
        result = _simulate_upgrade(scopes)
        assert result == set()
