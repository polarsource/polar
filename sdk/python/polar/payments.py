from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.literals import (
    PaymentSortProperty,
    PaymentStatus,
)
from polar.outputs import (
    ListResourcePayment,
    Payment,
)


class PaymentsSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        status: PaymentStatus | builtins.list[PaymentStatus] | None = None,
        method: str | builtins.list[str] | None = None,
        customer_email: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[PaymentSortProperty] | None = ["-created_at"],
    ) -> ListResourcePayment:
        """
        List payments.

        **Scopes**: `payments:read`

        Args:
            organization_id: Filter by organization ID.
            checkout_id: Filter by checkout ID.
            order_id: Filter by order ID.
            customer_id: Filter by customer ID.
            status: Filter by payment status.
            method: Filter by payment method.
            customer_email: Filter by customer email.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/payments/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "checkout_id": checkout_id,
                "order_id": order_id,
                "customer_id": customer_id,
                "status": status,
                "method": method,
                "customer_email": customer_email,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourcePayment, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        status: PaymentStatus | builtins.list[PaymentStatus] | None = None,
        method: str | builtins.list[str] | None = None,
        customer_email: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[PaymentSortProperty] | None = ["-created_at"],
    ) -> typing.Generator[Payment]:
        """
        List payments.

        **Scopes**: `payments:read`

        Args:
            organization_id: Filter by organization ID.
            checkout_id: Filter by checkout ID.
            order_id: Filter by order ID.
            customer_id: Filter by customer ID.
            status: Filter by payment status.
            method: Filter by payment method.
            customer_email: Filter by customer email.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            A generator that yields items of type Payment.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                checkout_id=checkout_id,
                order_id=order_id,
                customer_id=customer_id,
                status=status,
                method=method,
                customer_email=customer_email,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            yield from response.items
            if page == response.pagination.max_page:
                break
            page += 1

    def get(
        self,
        id: str,
    ) -> Payment:
        """
        Get a payment by ID.

        **Scopes**: `payments:read`

        Args:
            id: The payment ID.

        Raises:
            ResourceNotFound: Payment not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/payments/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Payment, method_errors)


class PaymentsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        status: PaymentStatus | builtins.list[PaymentStatus] | None = None,
        method: str | builtins.list[str] | None = None,
        customer_email: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[PaymentSortProperty] | None = ["-created_at"],
    ) -> ListResourcePayment:
        """
        List payments.

        **Scopes**: `payments:read`

        Args:
            organization_id: Filter by organization ID.
            checkout_id: Filter by checkout ID.
            order_id: Filter by order ID.
            customer_id: Filter by customer ID.
            status: Filter by payment status.
            method: Filter by payment method.
            customer_email: Filter by customer email.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/payments/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "checkout_id": checkout_id,
                "order_id": order_id,
                "customer_id": customer_id,
                "status": status,
                "method": method,
                "customer_email": customer_email,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourcePayment, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        status: PaymentStatus | builtins.list[PaymentStatus] | None = None,
        method: str | builtins.list[str] | None = None,
        customer_email: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[PaymentSortProperty] | None = ["-created_at"],
    ) -> typing.AsyncGenerator[Payment]:
        """
        List payments.

        **Scopes**: `payments:read`

        Args:
            organization_id: Filter by organization ID.
            checkout_id: Filter by checkout ID.
            order_id: Filter by order ID.
            customer_id: Filter by customer ID.
            status: Filter by payment status.
            method: Filter by payment method.
            customer_email: Filter by customer email.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            An async generator that yields items of type Payment.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                checkout_id=checkout_id,
                order_id=order_id,
                customer_id=customer_id,
                status=status,
                method=method,
                customer_email=customer_email,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            for item in response.items:
                yield item
            if page == response.pagination.max_page:
                break
            page += 1

    async def get(
        self,
        id: str,
    ) -> Payment:
        """
        Get a payment by ID.

        **Scopes**: `payments:read`

        Args:
            id: The payment ID.

        Raises:
            ResourceNotFound: Payment not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/payments/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Payment, method_errors)
