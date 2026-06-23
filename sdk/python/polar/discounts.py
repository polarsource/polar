from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
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
        return parse_response(response, ListResourceDiscount, method_errors)

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
        return parse_response(response, Discount, method_errors)

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
        return parse_response(response, Discount, method_errors)

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
        return parse_response(response, None, method_errors)

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
        return parse_response(response, Discount, method_errors)


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
        return parse_response(response, ListResourceDiscount, method_errors)

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

        Raises:
            HTTPValidationError: Validation Error
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
        return parse_response(response, Discount, method_errors)

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
        return parse_response(response, Discount, method_errors)

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
        return parse_response(response, None, method_errors)

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

        Raises:
            ResourceNotFound: Discount not found.
            HTTPValidationError: Validation Error
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
        return parse_response(response, Discount, method_errors)
