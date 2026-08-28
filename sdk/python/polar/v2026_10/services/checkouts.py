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
    CheckoutsClientConfirm403Error,
    CheckoutsClientUpdate403Error,
    CheckoutsUpdate403Error,
    ExpiredCheckoutError,
    HTTPValidationError,
    PaymentError,
    ResourceNotFound,
)
from polar.v2026_10.inputs import (
    CheckoutConfirmStripe,
    CheckoutCreate,
    CheckoutUpdate,
    CheckoutUpdatePublic,
)
from polar.v2026_10.literals import (
    CheckoutSortProperty,
    CheckoutStatus,
)
from polar.v2026_10.outputs import (
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
        request_timeout: RequestTimeout | None = None,
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
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCheckout, method_errors)

    def iter_list(
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
        request_timeout: RequestTimeout | None = None,
    ) -> typing.Generator[Checkout, None, None]:
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
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            A generator that yields items of type Checkout.

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
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                status=status,
                query=query,
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
        **kwargs: typing.Unpack[CheckoutCreate],
    ) -> Checkout:
        """
        Create a checkout session.

        **Scopes**: `checkouts:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkouts/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Checkout, method_errors)

    def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> Checkout:
        """
        Get a checkout session by ID.

        **Scopes**: `checkouts:read` `checkouts:write`

        Args:
            id: The checkout session ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Checkout session not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Checkout, method_errors)

    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[CheckoutUpdate],
    ) -> Checkout:
        """
        Update a checkout session.

        **Scopes**: `checkouts:write`

        Args:
            id: The checkout session ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            CheckoutsUpdate403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkouts/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: CheckoutsUpdate403Error,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Checkout, method_errors)

    def client_get(
        self,
        client_secret: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> CheckoutPublic:
        """
        Get a checkout session by client secret.

        Args:
            client_secret: The checkout session client secret.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/client/{client_secret}",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CheckoutPublic, method_errors)

    def client_update(
        self,
        client_secret: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[CheckoutUpdatePublic],
    ) -> CheckoutPublic:
        """
        Update a checkout session by client secret.

        Args:
            client_secret: The checkout session client secret.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            CheckoutsClientUpdate403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkouts/client/{client_secret}",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: CheckoutsClientUpdate403Error,
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CheckoutPublic, method_errors)

    def client_confirm(
        self,
        client_secret: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[CheckoutConfirmStripe],
    ) -> CheckoutPublicConfirmed:
        """
        Confirm a checkout session by client secret.

        Orders and subscriptions will be processed.

        Args:
            client_secret: The checkout session client secret.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            PaymentError: The payment failed.
            CheckoutsClientConfirm403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkouts/client/{client_secret}/confirm",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: PaymentError,
            403: CheckoutsClientConfirm403Error,
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CheckoutPublicConfirmed, method_errors)


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
        request_timeout: RequestTimeout | None = None,
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
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCheckout, method_errors)

    async def iter_list(
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
        request_timeout: RequestTimeout | None = None,
    ) -> typing.AsyncGenerator[Checkout, None]:
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
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            An async generator that yields items of type Checkout.

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
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                status=status,
                query=query,
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
        **kwargs: typing.Unpack[CheckoutCreate],
    ) -> Checkout:
        """
        Create a checkout session.

        **Scopes**: `checkouts:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkouts/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Checkout, method_errors)

    async def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> Checkout:
        """
        Get a checkout session by ID.

        **Scopes**: `checkouts:read` `checkouts:write`

        Args:
            id: The checkout session ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Checkout session not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Checkout, method_errors)

    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[CheckoutUpdate],
    ) -> Checkout:
        """
        Update a checkout session.

        **Scopes**: `checkouts:write`

        Args:
            id: The checkout session ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            CheckoutsUpdate403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkouts/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: CheckoutsUpdate403Error,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Checkout, method_errors)

    async def client_get(
        self,
        client_secret: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> CheckoutPublic:
        """
        Get a checkout session by client secret.

        Args:
            client_secret: The checkout session client secret.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkouts/client/{client_secret}",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CheckoutPublic, method_errors)

    async def client_update(
        self,
        client_secret: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[CheckoutUpdatePublic],
    ) -> CheckoutPublic:
        """
        Update a checkout session by client secret.

        Args:
            client_secret: The checkout session client secret.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            CheckoutsClientUpdate403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkouts/client/{client_secret}",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: CheckoutsClientUpdate403Error,
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CheckoutPublic, method_errors)

    async def client_confirm(
        self,
        client_secret: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[CheckoutConfirmStripe],
    ) -> CheckoutPublicConfirmed:
        """
        Confirm a checkout session by client secret.

        Orders and subscriptions will be processed.

        Args:
            client_secret: The checkout session client secret.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            PaymentError: The payment failed.
            CheckoutsClientConfirm403Error: The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
            ResourceNotFound: Checkout session not found.
            ExpiredCheckoutError: The checkout session is expired.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkouts/client/{client_secret}/confirm",
            path_params={
                "client_secret": client_secret,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: PaymentError,
            403: CheckoutsClientConfirm403Error,
            404: ResourceNotFound,
            410: ExpiredCheckoutError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CheckoutPublicConfirmed, method_errors)
