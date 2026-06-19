from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    ClientConfirm403Error,
    ClientUpdate403Error,
    ExpiredCheckoutError,
    HTTPValidationError,
    PaymentError,
    ResourceNotFound,
    Update403Error,
)
from polar.inputs import (
    CheckoutConfirmStripe,
    CheckoutCreate,
    CheckoutUpdate,
    CheckoutUpdatePublic,
)
from polar.literals import (
    CheckoutSortProperty,
    CheckoutStatus,
)
from polar.outputs import (
    Checkout,
    CheckoutPublic,
    CheckoutPublicConfirmed,
    ListResourceCheckout,
)


class CheckoutsSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        status: CheckoutStatus | builtins.list[CheckoutStatus] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CheckoutSortProperty] | None = ["-created_at"],
    ) -> ListResourceCheckout:
        """
        List checkout sessions.

        **Scopes**: `checkouts:read` `checkouts:write`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            status: Filter by checkout session status.
            query: Filter by customer email.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "status": status,
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
        return parse_response(response, ListResourceCheckout, method_errors)

    def create(
        self,
        **kwargs: typing.Unpack[CheckoutCreate],
    ) -> Checkout:
        """
        Create a checkout session.

        **Scopes**: `checkouts:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkouts/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Checkout, method_errors)

    def get(
        self,
        id: str,
    ) -> Checkout:
        """
        Get a checkout session by ID.

        **Scopes**: `checkouts:read` `checkouts:write`

        Args:
            id: The checkout session ID.

        Raises:
            ResourceNotFound: Checkout session not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/{id}",
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
        return parse_response(response, Checkout, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CheckoutUpdate],
    ) -> Checkout:
        """
        Update a checkout session.

        **Scopes**: `checkouts:write`

        Args:
            id: The checkout session ID.

        Raises:
            Update403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkouts/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: Update403Error,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Checkout, method_errors)

    def client_get(
        self,
        client_secret: str,
    ) -> CheckoutPublic:
        """
        Get a checkout session by client secret.

        Args:
            client_secret: The checkout session client secret.

        Raises:
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/client/{client_secret}",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response(response, CheckoutPublic, method_errors)

    def client_update(
        self,
        client_secret: str,
        **kwargs: typing.Unpack[CheckoutUpdatePublic],
    ) -> CheckoutPublic:
        """
        Update a checkout session by client secret.

        Args:
            client_secret: The checkout session client secret.

        Raises:
            ClientUpdate403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkouts/client/{client_secret}",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: ClientUpdate403Error,
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response(response, CheckoutPublic, method_errors)

    def client_confirm(
        self,
        client_secret: str,
        **kwargs: typing.Unpack[CheckoutConfirmStripe],
    ) -> CheckoutPublicConfirmed:
        """
        Confirm a checkout session by client secret.

        Orders and subscriptions will be processed.

        Args:
            client_secret: The checkout session client secret.

        Raises:
            PaymentError: The payment failed.
            ClientConfirm403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkouts/client/{client_secret}/confirm",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: PaymentError,
            403: ClientConfirm403Error,
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response(response, CheckoutPublicConfirmed, method_errors)


class CheckoutsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        status: CheckoutStatus | builtins.list[CheckoutStatus] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CheckoutSortProperty] | None = ["-created_at"],
    ) -> ListResourceCheckout:
        """
        List checkout sessions.

        **Scopes**: `checkouts:read` `checkouts:write`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            status: Filter by checkout session status.
            query: Filter by customer email.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "status": status,
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
        return parse_response(response, ListResourceCheckout, method_errors)

    async def create(
        self,
        **kwargs: typing.Unpack[CheckoutCreate],
    ) -> Checkout:
        """
        Create a checkout session.

        **Scopes**: `checkouts:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkouts/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Checkout, method_errors)

    async def get(
        self,
        id: str,
    ) -> Checkout:
        """
        Get a checkout session by ID.

        **Scopes**: `checkouts:read` `checkouts:write`

        Args:
            id: The checkout session ID.

        Raises:
            ResourceNotFound: Checkout session not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/{id}",
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
        return parse_response(response, Checkout, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CheckoutUpdate],
    ) -> Checkout:
        """
        Update a checkout session.

        **Scopes**: `checkouts:write`

        Args:
            id: The checkout session ID.

        Raises:
            Update403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkouts/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: Update403Error,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Checkout, method_errors)

    async def client_get(
        self,
        client_secret: str,
    ) -> CheckoutPublic:
        """
        Get a checkout session by client secret.

        Args:
            client_secret: The checkout session client secret.

        Raises:
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/client/{client_secret}",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response(response, CheckoutPublic, method_errors)

    async def client_update(
        self,
        client_secret: str,
        **kwargs: typing.Unpack[CheckoutUpdatePublic],
    ) -> CheckoutPublic:
        """
        Update a checkout session by client secret.

        Args:
            client_secret: The checkout session client secret.

        Raises:
            ClientUpdate403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkouts/client/{client_secret}",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: ClientUpdate403Error,
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response(response, CheckoutPublic, method_errors)

    async def client_confirm(
        self,
        client_secret: str,
        **kwargs: typing.Unpack[CheckoutConfirmStripe],
    ) -> CheckoutPublicConfirmed:
        """
        Confirm a checkout session by client secret.

        Orders and subscriptions will be processed.

        Args:
            client_secret: The checkout session client secret.

        Raises:
            PaymentError: The payment failed.
            ClientConfirm403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkouts/client/{client_secret}/confirm",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: PaymentError,
            403: ClientConfirm403Error,
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response(response, CheckoutPublicConfirmed, method_errors)
