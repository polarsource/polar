from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2026_10.errors import (
    HTTPValidationError,
)
from polar.v2026_10.inputs import (
    CustomerSessionCustomerExternalIDCreate,
    CustomerSessionCustomerIDCreate,
)
from polar.v2026_10.outputs import (
    CustomerSession,
)


class CustomerSessionsSync(SyncServiceBase):
    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSessionCustomerIDCreate],
    ) -> CustomerSession: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSessionCustomerExternalIDCreate],
    ) -> CustomerSession: ...

    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Any,
    ) -> CustomerSession:
        """
        Create a customer session.

        For organizations with `member_model_enabled`, this will automatically
        create a member session for the owner member of the customer.

        **Scopes**: `customer_sessions:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-sessions/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSession, method_errors)


class CustomerSessionsAsync(AsyncServiceBase):
    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSessionCustomerIDCreate],
    ) -> CustomerSession: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSessionCustomerExternalIDCreate],
    ) -> CustomerSession: ...

    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Any,
    ) -> CustomerSession:
        """
        Create a customer session.

        For organizations with `member_model_enabled`, this will automatically
        create a member session for the owner member of the customer.

        **Scopes**: `customer_sessions:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-sessions/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSession, method_errors)
