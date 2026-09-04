from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2026_10.outputs import (
    AuthorizeResponseOrganization,
    AuthorizeResponseUser,
    IntrospectTokenResponse,
    RevokeTokenResponse,
    TokenResponse,
    UserInfoOrganization,
    UserInfoUser,
)

from .clients import ClientsAsync, ClientsSync


class Oauth2Sync(SyncServiceBase):
    clients: ClientsSync

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.clients = ClientsSync.from_service(self)

    def authorize(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> AuthorizeResponseUser | AuthorizeResponseOrganization:
        """
        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/authorize",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        return parse_response_json(
            response, AuthorizeResponseUser | AuthorizeResponseOrganization
        )

    def request_token(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> TokenResponse:
        """
        Request an access token using a valid grant.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/token",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        return parse_response_json(response, TokenResponse)

    def revoke_token(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> RevokeTokenResponse:
        """
        Revoke an access token or a refresh token.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/revoke",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        return parse_response_json(response, RevokeTokenResponse)

    def introspect_token(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> IntrospectTokenResponse:
        """
        Get information about an access token.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/introspect",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        return parse_response_json(response, IntrospectTokenResponse)

    def userinfo(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> UserInfoUser | UserInfoOrganization:
        """
        Get information about the authenticated user.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/userinfo",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        return parse_response_json(response, UserInfoUser | UserInfoOrganization)


class Oauth2Async(AsyncServiceBase):
    clients: ClientsAsync

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.clients = ClientsAsync.from_service(self)

    async def authorize(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> AuthorizeResponseUser | AuthorizeResponseOrganization:
        """
        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/authorize",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        return parse_response_json(
            response, AuthorizeResponseUser | AuthorizeResponseOrganization
        )

    async def request_token(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> TokenResponse:
        """
        Request an access token using a valid grant.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/token",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, TokenResponse)

    async def revoke_token(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> RevokeTokenResponse:
        """
        Revoke an access token or a refresh token.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/revoke",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, RevokeTokenResponse)

    async def introspect_token(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> IntrospectTokenResponse:
        """
        Get information about an access token.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/introspect",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, IntrospectTokenResponse)

    async def userinfo(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> UserInfoUser | UserInfoOrganization:
        """
        Get information about the authenticated user.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/userinfo",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, UserInfoUser | UserInfoOrganization)
