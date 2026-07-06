from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    AlreadyCanceledSubscription,
    HTTPValidationError,
    PaymentFailed,
    ResourceNotFound,
)
from polar.inputs import (
    CustomerSubscriptionCancel,
    CustomerSubscriptionUpdateClear,
    CustomerSubscriptionUpdateProduct,
    CustomerSubscriptionUpdateSeats,
)
from polar.literals import (
    CustomerSubscriptionSortProperty,
)
from polar.outputs import (
    CustomerSubscription,
    ListResourceCustomerSubscription,
)


class SubscriptionsSync(SyncServiceBase):
    def list(
        self,
        *,
        product_id: str | builtins.list[str] | None = None,
        active: bool | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerSubscriptionSortProperty] | None = ["-started_at"],
    ) -> ListResourceCustomerSubscription:
        """
        List subscriptions of the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            product_id: Filter by product ID.
            active: Filter by active or cancelled subscription.
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
            url="/v1/customer-portal/subscriptions/",
            path_params={},
            query_params={
                "product_id": product_id,
                "active": active,
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
        return parse_response_json(
            response, ListResourceCustomerSubscription, method_errors
        )

    def iter_list(
        self,
        *,
        product_id: str | builtins.list[str] | None = None,
        active: bool | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerSubscriptionSortProperty] | None = ["-started_at"],
    ) -> typing.Generator[CustomerSubscription, None, None]:
        """
        List subscriptions of the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            product_id: Filter by product ID.
            active: Filter by active or cancelled subscription.
            query: Search by product or organization name.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            A generator that yields items of type CustomerSubscription.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                product_id=product_id,
                active=active,
                query=query,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def get(
        self,
        id: str,
    ) -> CustomerSubscription:
        """
        Get a subscription for the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: The subscription ID.

        Raises:
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/subscriptions/{id}",
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
        return parse_response_json(response, CustomerSubscription, method_errors)

    def cancel(
        self,
        id: str,
    ) -> CustomerSubscription:
        """
        Cancel a subscription of the authenticated customer.

        Args:
            id: The subscription ID.

        Raises:
            AlreadyCanceledSubscription: Customer subscription is already canceled or will be at the end of the period, or the user lacks billing permissions.
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/subscriptions/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            403: AlreadyCanceledSubscription,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSubscription, method_errors)

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateProduct],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateSeats],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerSubscriptionCancel],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateClear],
    ) -> CustomerSubscription: ...

    def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> CustomerSubscription:
        """
        Update a subscription of the authenticated customer.

        Args:
            id: The subscription ID.
            **kwargs: Request body parameters

        Raises:
            PaymentFailed: Payment required to apply the subscription update.
            AlreadyCanceledSubscription: Customer subscription is already canceled or will be at the end of the period, or the user lacks billing permissions.
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/subscriptions/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            402: PaymentFailed,
            403: AlreadyCanceledSubscription,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSubscription, method_errors)


class SubscriptionsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        product_id: str | builtins.list[str] | None = None,
        active: bool | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerSubscriptionSortProperty] | None = ["-started_at"],
    ) -> ListResourceCustomerSubscription:
        """
        List subscriptions of the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            product_id: Filter by product ID.
            active: Filter by active or cancelled subscription.
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
            url="/v1/customer-portal/subscriptions/",
            path_params={},
            query_params={
                "product_id": product_id,
                "active": active,
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
        return parse_response_json(
            response, ListResourceCustomerSubscription, method_errors
        )

    async def iter_list(
        self,
        *,
        product_id: str | builtins.list[str] | None = None,
        active: bool | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerSubscriptionSortProperty] | None = ["-started_at"],
    ) -> typing.AsyncGenerator[CustomerSubscription, None]:
        """
        List subscriptions of the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            product_id: Filter by product ID.
            active: Filter by active or cancelled subscription.
            query: Search by product or organization name.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            An async generator that yields items of type CustomerSubscription.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                product_id=product_id,
                active=active,
                query=query,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def get(
        self,
        id: str,
    ) -> CustomerSubscription:
        """
        Get a subscription for the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: The subscription ID.

        Raises:
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/subscriptions/{id}",
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
        return parse_response_json(response, CustomerSubscription, method_errors)

    async def cancel(
        self,
        id: str,
    ) -> CustomerSubscription:
        """
        Cancel a subscription of the authenticated customer.

        Args:
            id: The subscription ID.

        Raises:
            AlreadyCanceledSubscription: Customer subscription is already canceled or will be at the end of the period, or the user lacks billing permissions.
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/subscriptions/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: AlreadyCanceledSubscription,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSubscription, method_errors)

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateProduct],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateSeats],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerSubscriptionCancel],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateClear],
    ) -> CustomerSubscription: ...

    async def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> CustomerSubscription:
        """
        Update a subscription of the authenticated customer.

        Args:
            id: The subscription ID.
            **kwargs: Request body parameters

        Raises:
            PaymentFailed: Payment required to apply the subscription update.
            AlreadyCanceledSubscription: Customer subscription is already canceled or will be at the end of the period, or the user lacks billing permissions.
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/subscriptions/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            402: PaymentFailed,
            403: AlreadyCanceledSubscription,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSubscription, method_errors)
