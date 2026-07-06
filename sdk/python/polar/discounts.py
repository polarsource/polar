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
    DiscountFixedCreate,
    DiscountPercentageCreate,
    DiscountUpdate,
)
from polar.literals import (
    DiscountSortProperty,
)
from polar.outputs import (
    Discount,
    ListResourceDiscount,
)


class DiscountsSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[DiscountSortProperty] | None = ["-created_at"],
    ) -> ListResourceDiscount:
        """
        List discounts.

        **Scopes**: `discounts:read` `discounts:write`

        Args:
            organization_id: Filter by organization ID.
            query: Filter by name.
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
            url="/v1/discounts/",
            path_params={},
            query_params={
                "organization_id": organization_id,
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
        return parse_response_json(response, ListResourceDiscount, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[DiscountSortProperty] | None = ["-created_at"],
    ) -> typing.Generator[Discount, None, None]:
        """
        List discounts.

        **Scopes**: `discounts:read` `discounts:write`

        Args:
            organization_id: Filter by organization ID.
            query: Filter by name.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            A generator that yields items of type Discount.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                query=query,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[DiscountFixedCreate],
    ) -> Discount: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[DiscountPercentageCreate],
    ) -> Discount: ...

    def create(
        self,
        **kwargs: typing.Any,
    ) -> Discount:
        """
        Create a discount.

        **Scopes**: `discounts:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/discounts/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Discount, method_errors)

    def get(
        self,
        id: str,
    ) -> Discount:
        """
        Get a discount by ID.

        **Scopes**: `discounts:read` `discounts:write`

        Args:
            id: The discount ID.

        Raises:
            ResourceNotFound: Discount not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/discounts/{id}",
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
        return parse_response_json(response, Discount, method_errors)

    def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a discount.

        **Scopes**: `discounts:write`

        Args:
            id: The discount ID.

        Raises:
            ResourceNotFound: Discount not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/discounts/{id}",
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
        **kwargs: typing.Unpack[DiscountUpdate],
    ) -> Discount:
        """
        Update a discount.

        **Scopes**: `discounts:write`

        Args:
            id: The discount ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Discount not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/discounts/{id}",
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
        return parse_response_json(response, Discount, method_errors)


class DiscountsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[DiscountSortProperty] | None = ["-created_at"],
    ) -> ListResourceDiscount:
        """
        List discounts.

        **Scopes**: `discounts:read` `discounts:write`

        Args:
            organization_id: Filter by organization ID.
            query: Filter by name.
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
            url="/v1/discounts/",
            path_params={},
            query_params={
                "organization_id": organization_id,
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
        return parse_response_json(response, ListResourceDiscount, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[DiscountSortProperty] | None = ["-created_at"],
    ) -> typing.AsyncGenerator[Discount, None]:
        """
        List discounts.

        **Scopes**: `discounts:read` `discounts:write`

        Args:
            organization_id: Filter by organization ID.
            query: Filter by name.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            An async generator that yields items of type Discount.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
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

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[DiscountFixedCreate],
    ) -> Discount: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[DiscountPercentageCreate],
    ) -> Discount: ...

    async def create(
        self,
        **kwargs: typing.Any,
    ) -> Discount:
        """
        Create a discount.

        **Scopes**: `discounts:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/discounts/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Discount, method_errors)

    async def get(
        self,
        id: str,
    ) -> Discount:
        """
        Get a discount by ID.

        **Scopes**: `discounts:read` `discounts:write`

        Args:
            id: The discount ID.

        Raises:
            ResourceNotFound: Discount not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/discounts/{id}",
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
        return parse_response_json(response, Discount, method_errors)

    async def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a discount.

        **Scopes**: `discounts:write`

        Args:
            id: The discount ID.

        Raises:
            ResourceNotFound: Discount not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/discounts/{id}",
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
        **kwargs: typing.Unpack[DiscountUpdate],
    ) -> Discount:
        """
        Update a discount.

        **Scopes**: `discounts:write`

        Args:
            id: The discount ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Discount not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/discounts/{id}",
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
        return parse_response_json(response, Discount, method_errors)
