from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    AlreadyCanceledSubscription,
    HTTPValidationError,
    PaymentFailed,
    ResourceNotFound,
    SubscriptionLocked,
)
from polar.inputs import (
    MetadataQuery,
    SubscriptionCancel,
    SubscriptionCreateCustomer,
    SubscriptionCreateExternalCustomer,
    SubscriptionRevoke,
    SubscriptionUpdateBase,
    SubscriptionUpdateBillingPeriod,
    SubscriptionUpdateClear,
    SubscriptionUpdateSeats,
)
from polar.literals import (
    CustomerCancellationReason,
    SubscriptionSortProperty,
    SubscriptionStatus,
)
from polar.outputs import (
    ListResourceSubscription,
    Subscription,
)


class SubscriptionsSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        discount_id: str | builtins.list[str] | None = None,
        active: bool | None = None,
        status: SubscriptionStatus | builtins.list[SubscriptionStatus] | None = None,
        cancel_at_period_end: bool | None = None,
        customer_cancellation_reason: CustomerCancellationReason
        | builtins.list[CustomerCancellationReason]
        | None = None,
        canceled_at_after: str | None = None,
        canceled_at_before: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[SubscriptionSortProperty] | None = ["-started_at"],
        metadata: MetadataQuery = None,
    ) -> ListResourceSubscription:
        """
        List subscriptions.

        **Scopes**: `subscriptions:read` `subscriptions:write`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            discount_id: Filter by discount ID.
            active: Filter by active or inactive subscription.
            status: Filter by subscription status.
            cancel_at_period_end: Filter by subscriptions that are set to cancel at period end.
            customer_cancellation_reason: Filter by customer cancellation reason.
            canceled_at_after: Filter by cancellation date (after or equal to).
            canceled_at_before: Filter by cancellation date (before or equal to).
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/subscriptions/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "discount_id": discount_id,
                "active": active,
                "status": status,
                "cancel_at_period_end": cancel_at_period_end,
                "customer_cancellation_reason": customer_cancellation_reason,
                "canceled_at_after": canceled_at_after,
                "canceled_at_before": canceled_at_before,
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
        return parse_response(response, ListResourceSubscription, method_errors)

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[SubscriptionCreateCustomer],
    ) -> Subscription: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[SubscriptionCreateExternalCustomer],
    ) -> Subscription: ...

    def create(
        self,
        **kwargs: typing.Any,
    ) -> Subscription:
        """
        Create a subscription programmatically.

        This endpoint only allows to create subscription on free products.
        For paid products, use the checkout flow.

        No initial order will be created and no confirmation email will be sent.

        **Scopes**: `subscriptions:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/subscriptions/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Subscription, method_errors)

    def export(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
    ) -> typing.Any:
        """
        Export subscriptions as a CSV file.

        **Scopes**: `subscriptions:read` `subscriptions:write`

        Args:
            organization_id: Filter by organization ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/subscriptions/export",
            path_params={},
            query_params={
                "organization_id": organization_id,
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
    ) -> Subscription:
        """
        Get a subscription by ID.

        **Scopes**: `subscriptions:read` `subscriptions:write`

        Args:
            id: The subscription ID.

        Raises:
            ResourceNotFound: Subscription not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/subscriptions/{id}",
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
        return parse_response(response, Subscription, method_errors)

    def revoke(
        self,
        id: str,
    ) -> Subscription:
        """
        Revoke a subscription, i.e cancel immediately.

        **Scopes**: `subscriptions:write`

        Args:
            id: The subscription ID.

        Raises:
            AlreadyCanceledSubscription: This subscription is already revoked.
            ResourceNotFound: Subscription not found.
            SubscriptionLocked: Subscription is pending an update.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/subscriptions/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            403: AlreadyCanceledSubscription,
            404: ResourceNotFound,
            409: SubscriptionLocked,
            422: HTTPValidationError,
        }
        return parse_response(response, Subscription, method_errors)

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionUpdateBase],
    ) -> Subscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionUpdateSeats],
    ) -> Subscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionUpdateBillingPeriod],
    ) -> Subscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionCancel],
    ) -> Subscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionRevoke],
    ) -> Subscription: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionUpdateClear],
    ) -> Subscription: ...

    def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> Subscription:
        """
        Update a subscription.

        **Scopes**: `subscriptions:write`

        Args:
            id: The subscription ID.

        Raises:
            PaymentFailed: Payment required to apply the subscription update.
            AlreadyCanceledSubscription: Subscription is already canceled or will be at the end of the period.
            ResourceNotFound: Subscription not found.
            SubscriptionLocked: Subscription is pending an update.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/subscriptions/{id}",
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
            409: SubscriptionLocked,
            422: HTTPValidationError,
        }
        return parse_response(response, Subscription, method_errors)


class SubscriptionsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        discount_id: str | builtins.list[str] | None = None,
        active: bool | None = None,
        status: SubscriptionStatus | builtins.list[SubscriptionStatus] | None = None,
        cancel_at_period_end: bool | None = None,
        customer_cancellation_reason: CustomerCancellationReason
        | builtins.list[CustomerCancellationReason]
        | None = None,
        canceled_at_after: str | None = None,
        canceled_at_before: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[SubscriptionSortProperty] | None = ["-started_at"],
        metadata: MetadataQuery = None,
    ) -> ListResourceSubscription:
        """
        List subscriptions.

        **Scopes**: `subscriptions:read` `subscriptions:write`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            discount_id: Filter by discount ID.
            active: Filter by active or inactive subscription.
            status: Filter by subscription status.
            cancel_at_period_end: Filter by subscriptions that are set to cancel at period end.
            customer_cancellation_reason: Filter by customer cancellation reason.
            canceled_at_after: Filter by cancellation date (after or equal to).
            canceled_at_before: Filter by cancellation date (before or equal to).
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/subscriptions/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "discount_id": discount_id,
                "active": active,
                "status": status,
                "cancel_at_period_end": cancel_at_period_end,
                "customer_cancellation_reason": customer_cancellation_reason,
                "canceled_at_after": canceled_at_after,
                "canceled_at_before": canceled_at_before,
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
        return parse_response(response, ListResourceSubscription, method_errors)

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[SubscriptionCreateCustomer],
    ) -> Subscription: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[SubscriptionCreateExternalCustomer],
    ) -> Subscription: ...

    async def create(
        self,
        **kwargs: typing.Any,
    ) -> Subscription:
        """
        Create a subscription programmatically.

        This endpoint only allows to create subscription on free products.
        For paid products, use the checkout flow.

        No initial order will be created and no confirmation email will be sent.

        **Scopes**: `subscriptions:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/subscriptions/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Subscription, method_errors)

    async def export(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
    ) -> typing.Any:
        """
        Export subscriptions as a CSV file.

        **Scopes**: `subscriptions:read` `subscriptions:write`

        Args:
            organization_id: Filter by organization ID.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/subscriptions/export",
            path_params={},
            query_params={
                "organization_id": organization_id,
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
    ) -> Subscription:
        """
        Get a subscription by ID.

        **Scopes**: `subscriptions:read` `subscriptions:write`

        Args:
            id: The subscription ID.

        Raises:
            ResourceNotFound: Subscription not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/subscriptions/{id}",
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
        return parse_response(response, Subscription, method_errors)

    async def revoke(
        self,
        id: str,
    ) -> Subscription:
        """
        Revoke a subscription, i.e cancel immediately.

        **Scopes**: `subscriptions:write`

        Args:
            id: The subscription ID.

        Raises:
            AlreadyCanceledSubscription: This subscription is already revoked.
            ResourceNotFound: Subscription not found.
            SubscriptionLocked: Subscription is pending an update.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/subscriptions/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: AlreadyCanceledSubscription,
            404: ResourceNotFound,
            409: SubscriptionLocked,
            422: HTTPValidationError,
        }
        return parse_response(response, Subscription, method_errors)

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionUpdateBase],
    ) -> Subscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionUpdateSeats],
    ) -> Subscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionUpdateBillingPeriod],
    ) -> Subscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionCancel],
    ) -> Subscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionRevoke],
    ) -> Subscription: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[SubscriptionUpdateClear],
    ) -> Subscription: ...

    async def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> Subscription:
        """
        Update a subscription.

        **Scopes**: `subscriptions:write`

        Args:
            id: The subscription ID.

        Raises:
            PaymentFailed: Payment required to apply the subscription update.
            AlreadyCanceledSubscription: Subscription is already canceled or will be at the end of the period.
            ResourceNotFound: Subscription not found.
            SubscriptionLocked: Subscription is pending an update.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/subscriptions/{id}",
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
            409: SubscriptionLocked,
            422: HTTPValidationError,
        }
        return parse_response(response, Subscription, method_errors)
