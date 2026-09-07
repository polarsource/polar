from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from githubkit.exception import RequestFailed
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.github_repository_benefit.types import SimpleUser
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from tests.fixtures.database import SaveFixture


class _AsyncIter:
    """Stand-in for ``githubkit``'s ``client.paginate(...)`` async iterable.

    ``client.paginate(method, map_func=...)`` is consumed via
    ``async for ... in ...``; a plain ``MagicMock``'s ``__aiter__`` returns a
    sync iterator that ``async for`` rejects, so implement a proper one.
    """

    def __init__(self, items: list[object]) -> None:
        self._items = list(items)

    def __aiter__(self) -> "_AsyncIter":
        return self

    async def __anext__(self) -> object:
        if not self._items:
            raise StopAsyncIteration
        return self._items.pop(0)


@pytest.mark.asyncio
class TestUserRepositories:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/integrations/github_repository_benefit/user/repositories"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_branch_transient_failure_returns_200(
        self,
        client: AsyncClient,
        user: User,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        """A transient /user failure on a personal (User) install must NOT
        blank the dashboard with a 500 — the endpoint returns 200 and the
        degraded organization entry has ``plan_name == ""``.

        Mirrors the bug report: ``list_orgs_with_billing_plans`` would
        previously let ``RequestFailed`` from ``users.async_get_authenticated``
        propagate out of the endpoint.
        """
        oauth = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            account_id="12345",
            account_email="user@example.com",
            account_username="test-user",
            user=user,
            # ``expires_at`` is an epoch-int column. Set well in the future so
            # ``get_oauth_account`` does not attempt a token refresh (which
            # would call GitHub's OAuth token endpoint).
            expires_at=int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
        )
        await oauth.set_tokens(access_token="test_token", refresh_token=None)
        await save_fixture(oauth)

        # A "User" (personal-account) installation. ``account`` is spec'd as
        # ``SimpleUser`` to satisfy the ``isinstance`` guard in
        # ``get_billing_plan``.
        installation = MagicMock()
        installation.id = 60276577
        installation.target_type = "User"
        account_spec = MagicMock(spec=SimpleUser)
        account_spec.login = "test-user"
        account_spec.id = 123
        installation.account = account_spec

        # Mock the GitHub user OAuth client (token-strategy client).
        user_client = MagicMock()
        # /user fails transiently on the User branch.
        user_client.rest.users.async_get_authenticated = AsyncMock(
            side_effect=RequestFailed(
                MagicMock(status_code=503, json=lambda: {"message": "Unavailable"})
            )
        )
        # `list_user_installations` and `list_repositories` use paginate on
        # this same user client.
        user_client.paginate.return_value = _AsyncIter([installation])

        mocker.patch(
            "polar.integrations.github.client.get_client",
            return_value=user_client,
        )

        response = await client.get(
            "/v1/integrations/github_repository_benefit/user/repositories"
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert "organizations" in payload
        assert "repositories" in payload
        orgs = payload["organizations"]
        assert len(orgs) == 1
        assert orgs[0]["name"] == "test-user"
        assert orgs[0]["is_personal"] is True
        assert orgs[0]["plan_name"] == ""
        assert orgs[0]["is_free"] is False
