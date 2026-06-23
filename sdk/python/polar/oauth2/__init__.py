from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.outputs import (
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
    ) -> AuthorizeResponseUser | AuthorizeResponseOrganization:
        """

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/authorize",
            path_params={},
            query_params={},
        )
        response = self.client.send_request(request)
        return parse_response(
            response, AuthorizeResponseUser | AuthorizeResponseOrganization
        )

    def request_token(
        self,
    ) -> TokenResponse:
        """
        Request an access token using a valid grant.

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/token",
            path_params={},
            query_params={},
        )
        response = self.client.send_request(request)
        return parse_response(response, TokenResponse)

    def revoke_token(
        self,
    ) -> RevokeTokenResponse:
        """
        Revoke an access token or a refresh token.

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/revoke",
            path_params={},
            query_params={},
        )
        response = self.client.send_request(request)
        return parse_response(response, RevokeTokenResponse)

    def introspect_token(
        self,
    ) -> IntrospectTokenResponse:
        """
        Get information about an access token.

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/introspect",
            path_params={},
            query_params={},
        )
        response = self.client.send_request(request)
        return parse_response(response, IntrospectTokenResponse)

    def userinfo(
        self,
    ) -> UserInfoUser | UserInfoOrganization:
        """
        Get information about the authenticated user.

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/userinfo",
            path_params={},
            query_params={},
        )
        response = self.client.send_request(request)
        return parse_response(response, UserInfoUser | UserInfoOrganization)


class Oauth2Async(AsyncServiceBase):
    clients: ClientsAsync

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.clients = ClientsAsync.from_service(self)

    async def authorize(
        self,
    ) -> AuthorizeResponseUser | AuthorizeResponseOrganization:
        """

        Args:

        Raises:
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/authorize",
            path_params={},
            query_params={},
        )
        response = await self.client.send_request(request)
        return parse_response(
            response, AuthorizeResponseUser | AuthorizeResponseOrganization
        )

    async def request_token(
        self,
    ) -> TokenResponse:
        """
        Request an access token using a valid grant.

        Args:

        Raises:
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/token",
            path_params={},
            query_params={},
        )
        response = await self.client.send_request(request)
        return parse_response(response, TokenResponse)

    async def revoke_token(
        self,
    ) -> RevokeTokenResponse:
        """
        Revoke an access token or a refresh token.

        Args:

        Raises:
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/revoke",
            path_params={},
            query_params={},
        )
        response = await self.client.send_request(request)
        return parse_response(response, RevokeTokenResponse)

    async def introspect_token(
        self,
    ) -> IntrospectTokenResponse:
        """
        Get information about an access token.

        Args:

        Raises:
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/introspect",
            path_params={},
            query_params={},
        )
        response = await self.client.send_request(request)
        return parse_response(response, IntrospectTokenResponse)

    async def userinfo(
        self,
    ) -> UserInfoUser | UserInfoOrganization:
        """
        Get information about the authenticated user.

        Args:

        Raises:
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/userinfo",
            path_params={},
            query_params={},
        )
        response = await self.client.send_request(request)
        return parse_response(response, UserInfoUser | UserInfoOrganization)
