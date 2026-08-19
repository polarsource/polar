from __future__ import annotations

import builtins
import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2026_10.errors import (
    HTTPValidationError,
    RefundedAlready,
)
from polar.v2026_10.inputs import (
    RefundCreate,
)
from polar.v2026_10.literals import (
    RefundSortProperty,
)
from polar.v2026_10.outputs import (
    ListResourceRefund,
    Refund,
)


class RefundsSync(SyncServiceBase):
    def list(
        self,
        *,
        id: str | builtins.list[str] | None = None,
        organization_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        succeeded: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[RefundSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceRefund:
        """
        List refunds.

        **Scopes**: `refunds:read` `refunds:write`

        Args:
            id: Filter by refund ID.
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            subscription_id: Filter by subscription ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            succeeded: Filter by `succeeded`.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/refunds/",
            path_params={},
            query_params={
                "id": id,
                "organization_id": organization_id,
                "order_id": order_id,
                "subscription_id": subscription_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "succeeded": succeeded,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceRefund, method_errors)

    def iter_list(
        self,
        *,
        id: str | builtins.list[str] | None = None,
        organization_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        succeeded: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[RefundSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
    ) -> typing.Generator[Refund, None, None]:
        """
        List refunds.

        **Scopes**: `refunds:read` `refunds:write`

        Args:
            id: Filter by refund ID.
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            subscription_id: Filter by subscription ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            succeeded: Filter by `succeeded`.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            A generator that yields items of type Refund.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                id=id,
                organization_id=organization_id,
                order_id=order_id,
                subscription_id=subscription_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                succeeded=succeeded,
                page=page,
                limit=limit,
                sorting=sorting,
                request_timeout=request_timeout,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[RefundCreate],
    ) -> Refund:
        """
        Create a refund.

        **Scopes**: `refunds:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            RefundedAlready: Order is already fully refunded.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/refunds/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: RefundedAlready,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Refund, method_errors)


class RefundsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        id: str | builtins.list[str] | None = None,
        organization_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        succeeded: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[RefundSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceRefund:
        """
        List refunds.

        **Scopes**: `refunds:read` `refunds:write`

        Args:
            id: Filter by refund ID.
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            subscription_id: Filter by subscription ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            succeeded: Filter by `succeeded`.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/refunds/",
            path_params={},
            query_params={
                "id": id,
                "organization_id": organization_id,
                "order_id": order_id,
                "subscription_id": subscription_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "succeeded": succeeded,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceRefund, method_errors)

    async def iter_list(
        self,
        *,
        id: str | builtins.list[str] | None = None,
        organization_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        succeeded: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[RefundSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
    ) -> typing.AsyncGenerator[Refund, None]:
        """
        List refunds.

        **Scopes**: `refunds:read` `refunds:write`

        Args:
            id: Filter by refund ID.
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            subscription_id: Filter by subscription ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            succeeded: Filter by `succeeded`.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            An async generator that yields items of type Refund.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                id=id,
                organization_id=organization_id,
                order_id=order_id,
                subscription_id=subscription_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                succeeded=succeeded,
                page=page,
                limit=limit,
                sorting=sorting,
                request_timeout=request_timeout,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[RefundCreate],
    ) -> Refund:
        """
        Create a refund.

        **Scopes**: `refunds:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            RefundedAlready: Order is already fully refunded.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/refunds/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: RefundedAlready,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Refund, method_errors)
