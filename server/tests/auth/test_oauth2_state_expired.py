"""
Tests that ExpiredStateException and InvalidStateException from the reauth library
are properly caught and converted to redirect responses (303) instead of 500 errors.

Regression test for:
    Apple Sign In POST callback returns 500 when OAuth2 state is expired/invalid.
"""

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from pytest_mock import MockerFixture
from reauth.factors.oauth2.state import ExpiredStateException, InvalidStateException

from polar.app import app as polar_app
from polar.auth.oauth2.apple import get_apple_factor
from polar.auth.oauth2.github import get_github_factor
from polar.config import settings


@pytest.mark.asyncio
class TestOAuth2POSTCallback:
    """Tests for POST callback (Apple Sign In) with expired/invalid state."""

    async def test_post_callback_expired_state_returns_redirect(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        app: FastAPI,
    ) -> None:
        """POST callback with expired state should redirect (303), not 500."""
        mock_factor = AsyncMock()
        mock_factor.callback = AsyncMock(side_effect=ExpiredStateException())
        app.dependency_overrides[get_apple_factor] = lambda: mock_factor

        response = await client.post(
            "/v1/auth/apple/callback",
            data={"code": "test_code", "state": "expired_state"},
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "error" in response.headers["location"]

        del app.dependency_overrides[get_apple_factor]

    async def test_post_callback_invalid_state_returns_redirect(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        app: FastAPI,
    ) -> None:
        """POST callback with invalid state should redirect (303), not 500."""
        mock_factor = AsyncMock()
        mock_factor.callback = AsyncMock(side_effect=InvalidStateException())
        app.dependency_overrides[get_apple_factor] = lambda: mock_factor

        response = await client.post(
            "/v1/auth/apple/callback",
            data={"code": "test_code", "state": "invalid_state"},
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "error" in response.headers["location"]

        del app.dependency_overrides[get_apple_factor]

    async def test_get_callback_expired_state_with_valid_cookie_returns_redirect(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        app: FastAPI,
    ) -> None:
        """GET callback (GitHub) with expired state should redirect (303), not 500."""
        mock_factor = AsyncMock()
        mock_factor.callback = AsyncMock(side_effect=ExpiredStateException())
        app.dependency_overrides[get_github_factor] = lambda: mock_factor

        valid_state = "valid_state_token"
        response = await client.get(
            "/v1/auth/github/callback",
            params={"code": "test_code", "state": valid_state},
            cookies={settings.OAUTH2_SESSION_STATE_COOKIE_KEY: valid_state},
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "error" in response.headers["location"]

        del app.dependency_overrides[get_github_factor]

    async def test_get_callback_invalid_state_with_valid_cookie_returns_redirect(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        app: FastAPI,
    ) -> None:
        """GET callback (GitHub) with invalid state should redirect (303), not 500."""
        mock_factor = AsyncMock()
        mock_factor.callback = AsyncMock(side_effect=InvalidStateException())
        app.dependency_overrides[get_github_factor] = lambda: mock_factor

        valid_state = "valid_state_token"
        response = await client.get(
            "/v1/auth/github/callback",
            params={"code": "test_code", "state": valid_state},
            cookies={settings.OAUTH2_SESSION_STATE_COOKIE_KEY: valid_state},
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "error" in response.headers["location"]

        del app.dependency_overrides[get_github_factor]
