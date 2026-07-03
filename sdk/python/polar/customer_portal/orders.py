from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
    ManualRetryLimitExceeded,
    MissingInvoiceBillingDetails,
    OrderNotEligibleForInvoice,
    OrderNotEligibleForRetry,
    PaymentAlreadyInProgress,
    ResourceNotFound,
)
from polar.inputs import (
    CustomerOrderConfirmPayment,
    CustomerOrderUpdate,
)
from polar.literals import (
    CustomerOrderSortProperty,
    ProductBillingType,
)
from polar.outputs import (
    CustomerOrder,
    CustomerOrderInvoice,
    CustomerOrderPaymentConfirmation,
    CustomerOrderPaymentStatus,
    CustomerOrderReceipt,
    ListResourceCustomerOrder,
)


class OrdersSync(SyncServiceBase):
    def list(
        self,
        *,
        product_id: str | builtins.list[str] | None = None,
        product_billing_type: ProductBillingType
        | builtins.list[ProductBillingType]
        | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerOrderSortProperty] | None = ["-created_at"],
    ) -> ListResourceCustomerOrder:
        """
        List orders of the authenticated customer.

        Args:
            product_id: Filter by product ID.
            product_billing_type: Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            subscription_id: Filter by subscription ID.
            query: Search by product or organization name.
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
            url="/v1/customer-portal/orders/",
            path_params={},
            query_params={
                "product_id": product_id,
                "product_billing_type": product_billing_type,
                "subscription_id": subscription_id,
                "query": query,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomerOrder, method_errors)

    def iter_list(
        self,
        *,
        product_id: str | builtins.list[str] | None = None,
        product_billing_type: ProductBillingType
        | builtins.list[ProductBillingType]
        | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerOrderSortProperty] | None = ["-created_at"],
    ) -> typing.Generator[CustomerOrder]:
        """
        List orders of the authenticated customer.

        Args:
            product_id: Filter by product ID.
            product_billing_type: Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            subscription_id: Filter by subscription ID.
            query: Search by product or organization name.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            A generator that yields items of type CustomerOrder.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                product_id=product_id,
                product_billing_type=product_billing_type,
                subscription_id=subscription_id,
                query=query,
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
    ) -> CustomerOrder:
        """
        Get an order by ID for the authenticated customer.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/orders/{id}",
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
        return parse_response_json(response, CustomerOrder, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerOrderUpdate],
    ) -> CustomerOrder:
        """
        Update an order for the authenticated customer.

        Args:
            id: The order ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/orders/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerOrder, method_errors)

    def invoice(
        self,
        id: str,
    ) -> CustomerOrderInvoice:
        """
        Get an order's invoice data.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/orders/{id}/invoice",
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
        return parse_response_json(response, CustomerOrderInvoice, method_errors)

    def generate_invoice(
        self,
        id: str,
    ) -> typing.Any:
        """
        Trigger generation of an order's invoice.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            OrderNotEligibleForInvoice: Order is not eligible for invoice generation (invalid status).
            MissingInvoiceBillingDetails: Order is missing billing name or address.
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/orders/{id}/invoice",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: OrderNotEligibleForInvoice,
            422: MissingInvoiceBillingDetails,
        }
        return parse_response_json(response, typing.Any, method_errors)

    def receipt(
        self,
        id: str,
    ) -> CustomerOrderReceipt:
        """
        Get a presigned URL to download an order's receipt PDF.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/orders/{id}/receipt",
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
        return parse_response_json(response, CustomerOrderReceipt, method_errors)

    def get_payment_status(
        self,
        id: str,
    ) -> CustomerOrderPaymentStatus:
        """
        Get the current payment status for an order.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/orders/{id}/payment-status",
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
        return parse_response_json(response, CustomerOrderPaymentStatus, method_errors)

    def confirm_retry_payment(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerOrderConfirmPayment],
    ) -> CustomerOrderPaymentConfirmation:
        """
        Confirm a retry payment using a Stripe confirmation token.

        Args:
            id: The order ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Order not found.
            PaymentAlreadyInProgress: Payment already in progress.
            OrderNotEligibleForRetry: Order not eligible for retry or payment confirmation failed.
            ManualRetryLimitExceeded: Manual retry limit exceeded.
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/orders/{id}/confirm-payment",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: PaymentAlreadyInProgress,
            422: OrderNotEligibleForRetry,
            429: ManualRetryLimitExceeded,
        }
        return parse_response_json(
            response, CustomerOrderPaymentConfirmation, method_errors
        )


class OrdersAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        product_id: str | builtins.list[str] | None = None,
        product_billing_type: ProductBillingType
        | builtins.list[ProductBillingType]
        | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerOrderSortProperty] | None = ["-created_at"],
    ) -> ListResourceCustomerOrder:
        """
        List orders of the authenticated customer.

        Args:
            product_id: Filter by product ID.
            product_billing_type: Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            subscription_id: Filter by subscription ID.
            query: Search by product or organization name.
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
            url="/v1/customer-portal/orders/",
            path_params={},
            query_params={
                "product_id": product_id,
                "product_billing_type": product_billing_type,
                "subscription_id": subscription_id,
                "query": query,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomerOrder, method_errors)

    async def iter_list(
        self,
        *,
        product_id: str | builtins.list[str] | None = None,
        product_billing_type: ProductBillingType
        | builtins.list[ProductBillingType]
        | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerOrderSortProperty] | None = ["-created_at"],
    ) -> typing.AsyncGenerator[CustomerOrder]:
        """
        List orders of the authenticated customer.

        Args:
            product_id: Filter by product ID.
            product_billing_type: Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            subscription_id: Filter by subscription ID.
            query: Search by product or organization name.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            An async generator that yields items of type CustomerOrder.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                product_id=product_id,
                product_billing_type=product_billing_type,
                subscription_id=subscription_id,
                query=query,
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
    ) -> CustomerOrder:
        """
        Get an order by ID for the authenticated customer.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/orders/{id}",
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
        return parse_response_json(response, CustomerOrder, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerOrderUpdate],
    ) -> CustomerOrder:
        """
        Update an order for the authenticated customer.

        Args:
            id: The order ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/orders/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerOrder, method_errors)

    async def invoice(
        self,
        id: str,
    ) -> CustomerOrderInvoice:
        """
        Get an order's invoice data.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/orders/{id}/invoice",
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
        return parse_response_json(response, CustomerOrderInvoice, method_errors)

    async def generate_invoice(
        self,
        id: str,
    ) -> typing.Any:
        """
        Trigger generation of an order's invoice.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            OrderNotEligibleForInvoice: Order is not eligible for invoice generation (invalid status).
            MissingInvoiceBillingDetails: Order is missing billing name or address.
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/orders/{id}/invoice",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: OrderNotEligibleForInvoice,
            422: MissingInvoiceBillingDetails,
        }
        return parse_response_json(response, typing.Any, method_errors)

    async def receipt(
        self,
        id: str,
    ) -> CustomerOrderReceipt:
        """
        Get a presigned URL to download an order's receipt PDF.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/orders/{id}/receipt",
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
        return parse_response_json(response, CustomerOrderReceipt, method_errors)

    async def get_payment_status(
        self,
        id: str,
    ) -> CustomerOrderPaymentStatus:
        """
        Get the current payment status for an order.

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/orders/{id}/payment-status",
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
        return parse_response_json(response, CustomerOrderPaymentStatus, method_errors)

    async def confirm_retry_payment(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerOrderConfirmPayment],
    ) -> CustomerOrderPaymentConfirmation:
        """
        Confirm a retry payment using a Stripe confirmation token.

        Args:
            id: The order ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Order not found.
            PaymentAlreadyInProgress: Payment already in progress.
            OrderNotEligibleForRetry: Order not eligible for retry or payment confirmation failed.
            ManualRetryLimitExceeded: Manual retry limit exceeded.
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/orders/{id}/confirm-payment",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: PaymentAlreadyInProgress,
            422: OrderNotEligibleForRetry,
            429: ManualRetryLimitExceeded,
        }
        return parse_response_json(
            response, CustomerOrderPaymentConfirmation, method_errors
        )
