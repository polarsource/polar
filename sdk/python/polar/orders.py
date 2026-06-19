from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    Finalize402Error,
    Finalize403Error,
    GenerateInvoice422Error,
    HTTPValidationError,
    OrderNotDraft,
    ResourceNotFound,
)
from polar.inputs import (
    MetadataQuery,
    OrderCreate,
    OrderFinalize,
    OrderUpdate,
)
from polar.literals import (
    OrderSortProperty,
    ProductBillingType,
)
from polar.outputs import (
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
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrderSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
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
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
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
                "page": page,
                "limit": limit,
                "sorting": sorting,
                "metadata": metadata,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceOrder, method_errors)

    def create(
        self,
        **kwargs: typing.Unpack[OrderCreate],
    ) -> Order:
        """
        Create a draft order for an off-session charge against a saved payment
        method. The order is created with `status=draft` and no invoice number;
        call `POST /v1/orders/{id}/finalize` to attempt the charge.

        The organization must have the `off_session_charges_enabled` feature flag.

        **Scopes**: `orders:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Order, method_errors)

    def export(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
    ) -> typing.Any:
        """
        Export orders as a CSV file.

        **Scopes**: `orders:read`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/export",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    def get(
        self,
        id: str,
    ) -> Order:
        """
        Get an order by ID.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}",
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
        return parse_response(response, Order, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[OrderUpdate],
    ) -> Order:
        """
        Update an order.

        **Scopes**: `orders:write`

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/orders/{id}",
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
        return parse_response(response, Order, method_errors)

    def finalize(
        self,
        id: str,
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

        Raises:
            Finalize402Error: The charge failed, or requires customer authentication (e.g. a 3DS challenge) that can't be completed off-session.
            Finalize403Error: Off-session charges are not enabled for this organization, or its account can't currently accept payments.
            ResourceNotFound: Order not found.
            OrderNotDraft: The order is not in `draft` status.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/{id}/finalize",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            402: Finalize402Error,
            403: Finalize403Error,
            404: ResourceNotFound,
            412: OrderNotDraft,
            422: HTTPValidationError,
        }
        return parse_response(response, Order, method_errors)

    def invoice(
        self,
        id: str,
    ) -> OrderInvoice:
        """
        Get an order's invoice data.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}/invoice",
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
        return parse_response(response, OrderInvoice, method_errors)

    def generate_invoice(
        self,
        id: str,
    ) -> typing.Any:
        """
        Trigger generation of an order's invoice.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.

        Raises:
            GenerateInvoice422Error: Order is not paid or is missing billing name or address.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/{id}/invoice",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            422: GenerateInvoice422Error,
        }
        return parse_response(response, typing.Any, method_errors)

    def receipt(
        self,
        id: str,
    ) -> OrderReceipt:
        """
        Get a presigned URL to download an order's receipt PDF.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}/receipt",
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
        return parse_response(response, OrderReceipt, method_errors)


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
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrderSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
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
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
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
                "page": page,
                "limit": limit,
                "sorting": sorting,
                "metadata": metadata,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceOrder, method_errors)

    async def create(
        self,
        **kwargs: typing.Unpack[OrderCreate],
    ) -> Order:
        """
        Create a draft order for an off-session charge against a saved payment
        method. The order is created with `status=draft` and no invoice number;
        call `POST /v1/orders/{id}/finalize` to attempt the charge.

        The organization must have the `off_session_charges_enabled` feature flag.

        **Scopes**: `orders:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Order, method_errors)

    async def export(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
    ) -> typing.Any:
        """
        Export orders as a CSV file.

        **Scopes**: `orders:read`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/export",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    async def get(
        self,
        id: str,
    ) -> Order:
        """
        Get an order by ID.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}",
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
        return parse_response(response, Order, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[OrderUpdate],
    ) -> Order:
        """
        Update an order.

        **Scopes**: `orders:write`

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/orders/{id}",
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
        return parse_response(response, Order, method_errors)

    async def finalize(
        self,
        id: str,
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

        Raises:
            Finalize402Error: The charge failed, or requires customer authentication (e.g. a 3DS challenge) that can't be completed off-session.
            Finalize403Error: Off-session charges are not enabled for this organization, or its account can't currently accept payments.
            ResourceNotFound: Order not found.
            OrderNotDraft: The order is not in `draft` status.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/{id}/finalize",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            402: Finalize402Error,
            403: Finalize403Error,
            404: ResourceNotFound,
            412: OrderNotDraft,
            422: HTTPValidationError,
        }
        return parse_response(response, Order, method_errors)

    async def invoice(
        self,
        id: str,
    ) -> OrderInvoice:
        """
        Get an order's invoice data.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}/invoice",
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
        return parse_response(response, OrderInvoice, method_errors)

    async def generate_invoice(
        self,
        id: str,
    ) -> typing.Any:
        """
        Trigger generation of an order's invoice.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.

        Raises:
            GenerateInvoice422Error: Order is not paid or is missing billing name or address.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/orders/{id}/invoice",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: GenerateInvoice422Error,
        }
        return parse_response(response, typing.Any, method_errors)

    async def receipt(
        self,
        id: str,
    ) -> OrderReceipt:
        """
        Get a presigned URL to download an order's receipt PDF.

        **Scopes**: `orders:read`

        Args:
            id: The order ID.

        Raises:
            ResourceNotFound: Order not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/orders/{id}/receipt",
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
        return parse_response(response, OrderReceipt, method_errors)
