from __future__ import annotations

import builtins
import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
    parse_response_text,
)
from polar.v2026_10.errors import (
    HTTPValidationError,
    MissingInvoiceBillingDetails,
    OrderNotDraft,
    OrderNotEligibleForInvoice,
    OrdersFinalize402Error,
    OrdersFinalize403Error,
    ResourceNotFound,
)
from polar.v2026_10.inputs import (
    MetadataQuery,
    OrderCreate,
    OrderFinalize,
    OrderUpdate,
)
from polar.v2026_10.literals import (
    OrderExportColumn,
    OrderSortProperty,
    OrderStatus,
    ProductBillingType,
)
from polar.v2026_10.outputs import (
    ListResourceOrder,
    Order,
    OrderInvoice,
    OrderReceipt,
)


class OrdersSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        product_billing_type: ProductBillingType
        | builtins.list[ProductBillingType]
        | None = None,
        discount_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        status: OrderStatus | builtins.list[OrderStatus] | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrderSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceOrder:
        """
        List orders.

        **Scopes**: `orders:read`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            product_billing_type: Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            discount_id: Filter by discount ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            checkout_id: Filter by checkout ID.
            subscription_id: Filter by subscription ID.
            status: Filter by order status.
            created_after: Only include orders created after this date
            created_before: Only include orders created before this date
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "product_billing_type": product_billing_type,
                "discount_id": discount_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "checkout_id": checkout_id,
                "subscription_id": subscription_id,
                "status": status,
                "created_after": created_after,
                "created_before": created_before,
                "page": page,
                "limit": limit,
                "sorting": sorting,
                "metadata": metadata,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceOrder, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        product_billing_type: ProductBillingType
        | builtins.list[ProductBillingType]
        | None = None,
        discount_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        status: OrderStatus | builtins.list[OrderStatus] | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrderSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[Order, None, None]:
        """
        List orders.

        **Scopes**: `orders:read`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            product_billing_type: Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            discount_id: Filter by discount ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            checkout_id: Filter by checkout ID.
            subscription_id: Filter by subscription ID.
            status: Filter by order status.
            created_after: Only include orders created after this date
            created_before: Only include orders created before this date
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            A generator that yields items of type Order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                product_id=product_id,
                product_billing_type=product_billing_type,
                discount_id=discount_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                checkout_id=checkout_id,
                subscription_id=subscription_id,
                status=status,
                created_after=created_after,
                created_before=created_before,
                page=page,
                limit=limit,
                sorting=sorting,
                metadata=metadata,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[OrderCreate],
    ) -> Order:
        """
        Create a draft order for an off-session charge against a saved payment
        method. The order is created with `status=draft` and no invoice number;
        call `POST /v1/orders/{id}/finalize` to attempt the charge.

        The organization must have the `off_session_charges_enabled` feature flag.

        **Scopes**: `orders:write`

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
            url="/v1/orders/",
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
        return parse_response_json(response, Order, method_errors)

    def export(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        status: OrderStatus | builtins.list[OrderStatus] | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        timezone: str = "UTC",
        columns: OrderExportColumn | builtins.list[OrderExportColumn] | None = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> str:
        """
        Export orders as a CSV file.

        **Scopes**: `orders:read`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            status: Filter by order status.
            created_after: Only include orders created after this date. Must include a UTC offset.
            created_before: Only include orders created before this date. Must include a UTC offset.
            timezone: Time zone used to render dates in the CSV.
            columns: Columns to include in the CSV, in order. Defaults to email, created_at, product, net_amount, currency, status and invoice_number.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/export",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "status": status,
                "created_after": created_after,
                "created_before": created_before,
                "timezone": timezone,
                "columns": columns,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_text(response, method_errors)

    def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> Order:
        """
        Get an order by ID.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Order, method_errors)

    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[OrderUpdate],
    ) -> Order:
        """
        Update an order.

        **Scopes**: `orders:write`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/orders/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Order, method_errors)

    def finalize(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[OrderFinalize],
    ) -> Order:
        """
        Finalize a draft order and synchronously attempt an off-session charge.

        On success, the order transitions to `paid` and benefit grants fire
        before the response returns. On failure (decline, missing payment method,
        SCA challenge), the order stays in `draft` and a 4xx error is returned.

        The request fails with 412 if the order is not in `draft` status.

        **Scopes**: `orders:write`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            OrdersFinalize402Error: The charge failed, or requires customer authentication (e.g. a 3DS challenge) that can't be completed off-session.
            OrdersFinalize403Error: Off-session charges are not enabled for this organization, or its account can't currently accept payments.
            ResourceNotFound: Order not found.
            OrderNotDraft: The order is not in `draft` status.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/{id}/finalize",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            402: OrdersFinalize402Error,
            403: OrdersFinalize403Error,
            404: ResourceNotFound,
            412: OrderNotDraft,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Order, method_errors)

    def invoice(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> OrderInvoice:
        """
        Get an order's invoice data.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}/invoice",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, OrderInvoice, method_errors)

    def generate_invoice(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Any:
        """
        Trigger generation of an order's invoice.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Order not found.
            OrderNotEligibleForInvoice: Order is not eligible for invoice generation (invalid status).
            MissingInvoiceBillingDetails: Order is missing billing name or address.
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/{id}/invoice",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> OrderReceipt:
        """
        Get a presigned URL to download an order's receipt PDF.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}/receipt",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, OrderReceipt, method_errors)


class OrdersAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        product_billing_type: ProductBillingType
        | builtins.list[ProductBillingType]
        | None = None,
        discount_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        status: OrderStatus | builtins.list[OrderStatus] | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrderSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceOrder:
        """
        List orders.

        **Scopes**: `orders:read`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            product_billing_type: Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            discount_id: Filter by discount ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            checkout_id: Filter by checkout ID.
            subscription_id: Filter by subscription ID.
            status: Filter by order status.
            created_after: Only include orders created after this date
            created_before: Only include orders created before this date
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "product_billing_type": product_billing_type,
                "discount_id": discount_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "checkout_id": checkout_id,
                "subscription_id": subscription_id,
                "status": status,
                "created_after": created_after,
                "created_before": created_before,
                "page": page,
                "limit": limit,
                "sorting": sorting,
                "metadata": metadata,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceOrder, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        product_billing_type: ProductBillingType
        | builtins.list[ProductBillingType]
        | None = None,
        discount_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        status: OrderStatus | builtins.list[OrderStatus] | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrderSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[Order, None]:
        """
        List orders.

        **Scopes**: `orders:read`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            product_billing_type: Filter by product billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            discount_id: Filter by discount ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            checkout_id: Filter by checkout ID.
            subscription_id: Filter by subscription ID.
            status: Filter by order status.
            created_after: Only include orders created after this date
            created_before: Only include orders created before this date
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            An async generator that yields items of type Order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                product_id=product_id,
                product_billing_type=product_billing_type,
                discount_id=discount_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                checkout_id=checkout_id,
                subscription_id=subscription_id,
                status=status,
                created_after=created_after,
                created_before=created_before,
                page=page,
                limit=limit,
                sorting=sorting,
                metadata=metadata,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
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
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[OrderCreate],
    ) -> Order:
        """
        Create a draft order for an off-session charge against a saved payment
        method. The order is created with `status=draft` and no invoice number;
        call `POST /v1/orders/{id}/finalize` to attempt the charge.

        The organization must have the `off_session_charges_enabled` feature flag.

        **Scopes**: `orders:write`

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
            url="/v1/orders/",
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
        return parse_response_json(response, Order, method_errors)

    async def export(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        status: OrderStatus | builtins.list[OrderStatus] | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        timezone: str = "UTC",
        columns: OrderExportColumn | builtins.list[OrderExportColumn] | None = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> str:
        """
        Export orders as a CSV file.

        **Scopes**: `orders:read`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            status: Filter by order status.
            created_after: Only include orders created after this date. Must include a UTC offset.
            created_before: Only include orders created before this date. Must include a UTC offset.
            timezone: Time zone used to render dates in the CSV.
            columns: Columns to include in the CSV, in order. Defaults to email, created_at, product, net_amount, currency, status and invoice_number.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/export",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "status": status,
                "created_after": created_after,
                "created_before": created_before,
                "timezone": timezone,
                "columns": columns,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_text(response, method_errors)

    async def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> Order:
        """
        Get an order by ID.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Order, method_errors)

    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[OrderUpdate],
    ) -> Order:
        """
        Update an order.

        **Scopes**: `orders:write`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/orders/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Order, method_errors)

    async def finalize(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[OrderFinalize],
    ) -> Order:
        """
        Finalize a draft order and synchronously attempt an off-session charge.

        On success, the order transitions to `paid` and benefit grants fire
        before the response returns. On failure (decline, missing payment method,
        SCA challenge), the order stays in `draft` and a 4xx error is returned.

        The request fails with 412 if the order is not in `draft` status.

        **Scopes**: `orders:write`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            OrdersFinalize402Error: The charge failed, or requires customer authentication (e.g. a 3DS challenge) that can't be completed off-session.
            OrdersFinalize403Error: Off-session charges are not enabled for this organization, or its account can't currently accept payments.
            ResourceNotFound: Order not found.
            OrderNotDraft: The order is not in `draft` status.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/{id}/finalize",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            402: OrdersFinalize402Error,
            403: OrdersFinalize403Error,
            404: ResourceNotFound,
            412: OrderNotDraft,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Order, method_errors)

    async def invoice(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> OrderInvoice:
        """
        Get an order's invoice data.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}/invoice",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, OrderInvoice, method_errors)

    async def generate_invoice(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Any:
        """
        Trigger generation of an order's invoice.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Order not found.
            OrderNotEligibleForInvoice: Order is not eligible for invoice generation (invalid status).
            MissingInvoiceBillingDetails: Order is missing billing name or address.
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/{id}/invoice",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> OrderReceipt:
        """
        Get a presigned URL to download an order's receipt PDF.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}/receipt",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, OrderReceipt, method_errors)
