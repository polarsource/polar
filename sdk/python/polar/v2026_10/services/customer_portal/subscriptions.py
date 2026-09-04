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
    AlreadyCanceledSubscription,
    CustomerPortalSubscriptionsUpdate403Error,
    HTTPValidationError,
    PaymentFailed,
    PaymentMethodRequired,
    ResourceNotFound,
)
from polar.v2026_10.inputs import (
    CustomerSubscriptionCancel,
    CustomerSubscriptionPause,
    CustomerSubscriptionResume,
    CustomerSubscriptionUpdateClear,
    CustomerSubscriptionUpdateProduct,
    CustomerSubscriptionUpdateSeats,
    CustomerSubscriptionUpdateUnits,
)
from polar.v2026_10.literals import (
    CustomerSubscriptionSortProperty,
)
from polar.v2026_10.outputs import (
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
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
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            A generator that yields items of type CustomerSubscription.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerSubscription:
        """
        Get a subscription for the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: The subscription ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/subscriptions/{id}",
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
        return parse_response_json(response, CustomerSubscription, method_errors)

    def cancel(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerSubscription:
        """
        Cancel a subscription of the authenticated customer.

        Args:
            id: The subscription ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            AlreadyCanceledSubscription: Customer subscription is already canceled or will be at the end of the period, or the user lacks billing permissions.
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/subscriptions/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateProduct],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateSeats],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateUnits],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionCancel],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionPause],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionResume],
    ) -> CustomerSubscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateClear],
    ) -> CustomerSubscription: ...

    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Any,
    ) -> CustomerSubscription:
        """
        Update a subscription of the authenticated customer.

        Args:
            id: The subscription ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            PaymentFailed: Payment required to apply the subscription update.
            CustomerPortalSubscriptionsUpdate403Error: Customer subscription is already canceled or will be at the end of the period, the user lacks billing permissions, or pausing/resuming is not enabled for the organization.
            ResourceNotFound: Customer subscription was not found.
            PaymentMethodRequired: The subscription has no payment method to charge.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/subscriptions/{id}",
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
            402: PaymentFailed,
            403: CustomerPortalSubscriptionsUpdate403Error,
            404: ResourceNotFound,
            409: PaymentMethodRequired,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
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
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            An async generator that yields items of type CustomerSubscription.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerSubscription:
        """
        Get a subscription for the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: The subscription ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/subscriptions/{id}",
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
        return parse_response_json(response, CustomerSubscription, method_errors)

    async def cancel(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerSubscription:
        """
        Cancel a subscription of the authenticated customer.

        Args:
            id: The subscription ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            AlreadyCanceledSubscription: Customer subscription is already canceled or will be at the end of the period, or the user lacks billing permissions.
            ResourceNotFound: Customer subscription was not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/subscriptions/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateProduct],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateSeats],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateUnits],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionCancel],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionPause],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionResume],
    ) -> CustomerSubscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSubscriptionUpdateClear],
    ) -> CustomerSubscription: ...

    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Any,
    ) -> CustomerSubscription:
        """
        Update a subscription of the authenticated customer.

        Args:
            id: The subscription ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            PaymentFailed: Payment required to apply the subscription update.
            CustomerPortalSubscriptionsUpdate403Error: Customer subscription is already canceled or will be at the end of the period, the user lacks billing permissions, or pausing/resuming is not enabled for the organization.
            ResourceNotFound: Customer subscription was not found.
            PaymentMethodRequired: The subscription has no payment method to charge.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/subscriptions/{id}",
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
            402: PaymentFailed,
            403: CustomerPortalSubscriptionsUpdate403Error,
            404: ResourceNotFound,
            409: PaymentMethodRequired,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSubscription, method_errors)
