from __future__ import annotations

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2026_04.outputs import (
    CustomerCustomerSession,
    PortalAuthenticatedUser,
)


class CustomerSessionSync(SyncServiceBase):
    def introspect(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> CustomerCustomerSession:
        """
        Introspect the current session and return its information.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


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
        )
        response = self.client.send_request(request)
        return parse_response_json(response, CustomerCustomerSession)

    def get_authenticated_user(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> PortalAuthenticatedUser:
        """
        Get information about the currently authenticated portal user.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


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
        )
        response = self.client.send_request(request)
        return parse_response_json(response, PortalAuthenticatedUser)


class CustomerSessionAsync(AsyncServiceBase):
    async def introspect(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> CustomerCustomerSession:
        """
        Introspect the current session and return its information.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


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
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, CustomerCustomerSession)

    async def get_authenticated_user(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> PortalAuthenticatedUser:
        """
        Get information about the currently authenticated portal user.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


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
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, PortalAuthenticatedUser)
