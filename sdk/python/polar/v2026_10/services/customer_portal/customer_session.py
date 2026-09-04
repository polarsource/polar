from __future__ import annotations

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2026_10.outputs import (
    CustomerCustomerSession,
    PortalAuthenticatedUser,
)


class CustomerSessionSync(SyncServiceBase):
    def introspect(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerCustomerSession:
        """
        Introspect the current session and return its information.

        **Scopes**: `customer_portal:read` `customer_portal:write`

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
            url="/v1/customer-portal/customer-session/introspect",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        return parse_response_json(response, CustomerCustomerSession)

    def get_authenticated_user(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> PortalAuthenticatedUser:
        """
        Get information about the currently authenticated portal user.

        **Scopes**: `customer_portal:read` `customer_portal:write`

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
            url="/v1/customer-portal/customer-session/user",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        return parse_response_json(response, PortalAuthenticatedUser)


class CustomerSessionAsync(AsyncServiceBase):
    async def introspect(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerCustomerSession:
        """
        Introspect the current session and return its information.

        **Scopes**: `customer_portal:read` `customer_portal:write`

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
            url="/v1/customer-portal/customer-session/introspect",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, CustomerCustomerSession)

    async def get_authenticated_user(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> PortalAuthenticatedUser:
        """
        Get information about the currently authenticated portal user.

        **Scopes**: `customer_portal:read` `customer_portal:write`

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
            url="/v1/customer-portal/customer-session/user",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, PortalAuthenticatedUser)
