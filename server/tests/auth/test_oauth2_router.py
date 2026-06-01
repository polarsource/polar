from collections.abc import Callable, Iterator
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from reauth.factors.oauth2.oidc import DiscoveryDocumentException, JWKSFetchException

from polar.auth.authentication_session import (
    get_authentication_session,
    get_authentication_session_service,
    get_optional_authentication_session,
)
from polar.auth.oauth2.google import get_google_factor
from polar.auth.oauth2.router import OIDC_ERROR_MESSAGE
from polar.config import settings
from tests.fixtures.auth import AuthSubjectFixture


class StubOAuth2Factor:
    identifier = "google"
    SCOPE = ["openid", "email", "profile"]

    def __init__(
        self,
        *,
        start_exception: Exception | None = None,
        callback_exception: Exception | None = None,
    ) -> None:
        self.start_exception = start_exception
        self.callback_exception = callback_exception

    async def start(self, **kwargs: object) -> tuple[str, str, SimpleNamespace]:
        if self.start_exception is not None:
            raise self.start_exception
        return "https://example.com", "state", SimpleNamespace(expires_at=1)

    async def callback(self, **kwargs: object) -> tuple[None, None, SimpleNamespace]:
        if self.callback_exception is not None:
            raise self.callback_exception
        return None, None, SimpleNamespace(context={})


class StubAuthenticationSessionService:
    def __init__(self, factor: StubOAuth2Factor) -> None:
        self.factor = factor

    async def get_available_factors(
        self, authentication_session: object
    ) -> list[StubOAuth2Factor]:
        return [self.factor]


@pytest.fixture
def override_google_oauth_dependencies(
    app: FastAPI,
) -> Iterator[Callable[[StubOAuth2Factor], None]]:
    overrides = (
        get_google_factor,
        get_authentication_session,
        get_optional_authentication_session,
        get_authentication_session_service,
    )

    def override(factor: StubOAuth2Factor) -> None:
        async def get_factor() -> StubOAuth2Factor:
            return factor

        async def get_session() -> SimpleNamespace:
            return SimpleNamespace(token_hash="test-token-hash")

        async def get_service() -> StubAuthenticationSessionService:
            return StubAuthenticationSessionService(factor)

        app.dependency_overrides[get_google_factor] = get_factor
        app.dependency_overrides[get_authentication_session] = get_session
        app.dependency_overrides[get_optional_authentication_session] = get_session
        app.dependency_overrides[get_authentication_session_service] = get_service

    yield override

    for dependency in overrides:
        app.dependency_overrides.pop(dependency, None)


def assert_error_redirect(
    response_location: str,
    *,
    expected_url: str,
    expected_extra: dict[str, str] | None = None,
) -> None:
    parsed = urlparse(response_location)
    assert parsed._replace(query="", fragment="").geturl() == expected_url

    query = parse_qs(parsed.query)
    assert query["error"] == [OIDC_ERROR_MESSAGE]
    for key, value in (expected_extra or {}).items():
        assert query[key] == [value]


@pytest.mark.asyncio
class TestOAuth2RouterOIDCExceptions:
    @pytest.mark.parametrize(
        "exception", [DiscoveryDocumentException(), JWKSFetchException()]
    )
    async def test_login_authorize_redirects_on_oidc_exception(
        self,
        client: AsyncClient,
        override_google_oauth_dependencies: Callable[[StubOAuth2Factor], None],
        exception: Exception,
    ) -> None:
        override_google_oauth_dependencies(
            StubOAuth2Factor(start_exception=exception)
        )

        response = await client.get("/v1/auth/google/authorize")

        assert response.status_code == 303
        assert_error_redirect(
            response.headers["location"],
            expected_url=settings.generate_frontend_url("/auth"),
        )

    @pytest.mark.parametrize(
        "exception", [DiscoveryDocumentException(), JWKSFetchException()]
    )
    async def test_login_callback_redirects_on_oidc_exception(
        self,
        client: AsyncClient,
        override_google_oauth_dependencies: Callable[[StubOAuth2Factor], None],
        exception: Exception,
    ) -> None:
        override_google_oauth_dependencies(
            StubOAuth2Factor(callback_exception=exception)
        )

        response = await client.get(
            "/v1/auth/google/callback?state=test-state",
            cookies={settings.OAUTH2_SESSION_STATE_COOKIE_KEY: "test-state"},
        )

        assert response.status_code == 303
        assert_error_redirect(
            response.headers["location"],
            expected_url=settings.generate_frontend_url("/auth"),
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    @pytest.mark.parametrize(
        "exception", [DiscoveryDocumentException(), JWKSFetchException()]
    )
    async def test_link_authorize_redirects_on_oidc_exception(
        self,
        client: AsyncClient,
        override_google_oauth_dependencies: Callable[[StubOAuth2Factor], None],
        exception: Exception,
    ) -> None:
        override_google_oauth_dependencies(
            StubOAuth2Factor(start_exception=exception)
        )

        response = await client.get(
            "/v1/auth/google/link/authorize?return_to=/settings/account"
        )

        assert response.status_code == 303
        assert_error_redirect(
            response.headers["location"],
            expected_url=settings.generate_frontend_url("/settings/account"),
            expected_extra={"type": "oauth_link_error", "factor": "google"},
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    @pytest.mark.parametrize(
        "exception", [DiscoveryDocumentException(), JWKSFetchException()]
    )
    async def test_link_callback_redirects_on_oidc_exception(
        self,
        client: AsyncClient,
        override_google_oauth_dependencies: Callable[[StubOAuth2Factor], None],
        exception: Exception,
    ) -> None:
        override_google_oauth_dependencies(
            StubOAuth2Factor(callback_exception=exception)
        )

        response = await client.get(
            "/v1/auth/google/link/callback?state=test-state",
            cookies={settings.OAUTH2_SESSION_STATE_COOKIE_KEY: "test-state"},
        )

        assert response.status_code == 303
        assert_error_redirect(
            response.headers["location"],
            expected_url=settings.generate_frontend_url(
                "/dashboard/account/preferences"
            ),
            expected_extra={"type": "oauth_link_error", "factor": "google"},
        )
