from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
)
from polar.inputs import (
    OAuth2ClientConfiguration,
    OAuth2ClientConfigurationUpdate,
)


class Oauth2Sync(SyncServiceBase):
    def create_client(
        self,
        **kwargs: typing.Unpack[OAuth2ClientConfiguration],
    ) -> typing.Any:
        """
        Create an OAuth2 client.

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/register",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)

    def get_client(
        self,
        client_id: str,
    ) -> typing.Any:
        """
        Get an OAuth2 client by Client ID.

        Args:
            client_id:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/register/{client_id}",
            path_params={
                "client_id": client_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)

    def update_client(
        self,
        client_id_path: str,
        **kwargs: typing.Unpack[OAuth2ClientConfigurationUpdate],
    ) -> typing.Any:
        """
        Update an OAuth2 client.

        Args:
            client_id_path:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PUT",
            url="/v1/oauth2/register/{client_id}",
            path_params={
                "client_id": client_id_path,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)

    def delete_client(
        self,
        client_id: str,
    ) -> typing.Any:
        """
        Delete an OAuth2 client.

        Args:
            client_id:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/oauth2/register/{client_id}",
            path_params={
                "client_id": client_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)


class Oauth2Async(AsyncServiceBase):
    async def create_client(
        self,
        **kwargs: typing.Unpack[OAuth2ClientConfiguration],
    ) -> typing.Any:
        """
        Create an OAuth2 client.

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/oauth2/register",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)

    async def get_client(
        self,
        client_id: str,
    ) -> typing.Any:
        """
        Get an OAuth2 client by Client ID.

        Args:
            client_id:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/oauth2/register/{client_id}",
            path_params={
                "client_id": client_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)

    async def update_client(
        self,
        client_id_path: str,
        **kwargs: typing.Unpack[OAuth2ClientConfigurationUpdate],
    ) -> typing.Any:
        """
        Update an OAuth2 client.

        Args:
            client_id_path:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PUT",
            url="/v1/oauth2/register/{client_id}",
            path_params={
                "client_id": client_id_path,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)

    async def delete_client(
        self,
        client_id: str,
    ) -> typing.Any:
        """
        Delete an OAuth2 client.

        Args:
            client_id:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/oauth2/register/{client_id}",
            path_params={
                "client_id": client_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)
