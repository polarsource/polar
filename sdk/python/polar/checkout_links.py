from __future__ import annotations

import builtins
import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.inputs import (
    CheckoutLinkCreateProduct,
    CheckoutLinkCreateProductPrice,
    CheckoutLinkCreateProducts,
    CheckoutLinkUpdate,
)
from polar.literals import (
    CheckoutLinkSortProperty,
)
from polar.outputs import (
    CheckoutLink,
    ListResourceCheckoutLink,
)


class CheckoutLinksSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CheckoutLinkSortProperty] | None = ["created_at"],
    ) -> ListResourceCheckoutLink:
        """
        List checkout links.

        **Scopes**: `checkout_links:read` `checkout_links:write`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
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
            url="/v1/checkout-links/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCheckoutLink, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CheckoutLinkSortProperty] | None = ["created_at"],
    ) -> typing.Generator[CheckoutLink]:
        """
        List checkout links.

        **Scopes**: `checkout_links:read` `checkout_links:write`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            A generator that yields items of type CheckoutLink.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                product_id=product_id,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            yield from response.items
            if page == response.pagination.max_page:
                break
            page += 1

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CheckoutLinkCreateProductPrice],
    ) -> CheckoutLink: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CheckoutLinkCreateProduct],
    ) -> CheckoutLink: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CheckoutLinkCreateProducts],
    ) -> CheckoutLink: ...

    def create(
        self,
        **kwargs: typing.Any,
    ) -> CheckoutLink:
        """
        Create a checkout link.

        **Scopes**: `checkout_links:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkout-links/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, CheckoutLink, method_errors)

    def get(
        self,
        id: str,
    ) -> CheckoutLink:
        """
        Get a checkout link by ID.

        **Scopes**: `checkout_links:read` `checkout_links:write`

        Args:
            id: The checkout link ID.

        Raises:
            ResourceNotFound: Checkout link not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkout-links/{id}",
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
        return parse_response_json(response, CheckoutLink, method_errors)

    def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a checkout link.

        **Scopes**: `checkout_links:write`

        Args:
            id: The checkout link ID.

        Raises:
            ResourceNotFound: Checkout link not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/checkout-links/{id}",
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
        return parse_response_none(response, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CheckoutLinkUpdate],
    ) -> CheckoutLink:
        """
        Update a checkout link.

        **Scopes**: `checkout_links:write`

        Args:
            id: The checkout link ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Checkout link not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkout-links/{id}",
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
        return parse_response_json(response, CheckoutLink, method_errors)


class CheckoutLinksAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CheckoutLinkSortProperty] | None = ["created_at"],
    ) -> ListResourceCheckoutLink:
        """
        List checkout links.

        **Scopes**: `checkout_links:read` `checkout_links:write`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
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
            url="/v1/checkout-links/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "product_id": product_id,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCheckoutLink, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        product_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CheckoutLinkSortProperty] | None = ["created_at"],
    ) -> typing.AsyncGenerator[CheckoutLink]:
        """
        List checkout links.

        **Scopes**: `checkout_links:read` `checkout_links:write`

        Args:
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            An async generator that yields items of type CheckoutLink.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                product_id=product_id,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            for item in response.items:
                yield item
            if page == response.pagination.max_page:
                break
            page += 1

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CheckoutLinkCreateProductPrice],
    ) -> CheckoutLink: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CheckoutLinkCreateProduct],
    ) -> CheckoutLink: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CheckoutLinkCreateProducts],
    ) -> CheckoutLink: ...

    async def create(
        self,
        **kwargs: typing.Any,
    ) -> CheckoutLink:
        """
        Create a checkout link.

        **Scopes**: `checkout_links:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/checkout-links/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, CheckoutLink, method_errors)

    async def get(
        self,
        id: str,
    ) -> CheckoutLink:
        """
        Get a checkout link by ID.

        **Scopes**: `checkout_links:read` `checkout_links:write`

        Args:
            id: The checkout link ID.

        Raises:
            ResourceNotFound: Checkout link not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/checkout-links/{id}",
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
        return parse_response_json(response, CheckoutLink, method_errors)

    async def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a checkout link.

        **Scopes**: `checkout_links:write`

        Args:
            id: The checkout link ID.

        Raises:
            ResourceNotFound: Checkout link not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/checkout-links/{id}",
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
        return parse_response_none(response, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CheckoutLinkUpdate],
    ) -> CheckoutLink:
        """
        Update a checkout link.

        **Scopes**: `checkout_links:write`

        Args:
            id: The checkout link ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Checkout link not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/checkout-links/{id}",
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
        return parse_response_json(response, CheckoutLink, method_errors)
