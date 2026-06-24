from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
    NotPermitted,
    ResourceNotFound,
)
from polar.inputs import (
    MetadataQuery,
    ProductBenefitsUpdate,
    ProductCreateOneTime,
    ProductCreateRecurring,
    ProductUpdate,
)
from polar.literals import (
    ProductSortProperty,
    ProductVisibility,
)
from polar.outputs import (
    ListResourceProduct,
    Product,
)


class ProductsSync(SyncServiceBase):
    def list(
        self,
        *,
        id: str | builtins.list[str] | None = None,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        is_archived: bool | None = None,
        is_recurring: bool | None = None,
        benefit_id: str | builtins.list[str] | None = None,
        visibility: builtins.list[ProductVisibility] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[ProductSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
    ) -> ListResourceProduct:
        """
        List products.

        **Scopes**: `products:read` `products:write`

        Args:
            id: Filter by product ID.
            organization_id: Filter by organization ID.
            query: Filter by product name.
            is_archived: Filter on archived products.
            is_recurring: Filter on recurring products. If `true`, only subscriptions tiers are returned. If `false`, only one-time purchase products are returned.
            benefit_id: Filter products granting specific benefit.
            visibility: Filter by visibility.
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
            url="/v1/products/",
            path_params={},
            query_params={
                "id": id,
                "organization_id": organization_id,
                "query": query,
                "is_archived": is_archived,
                "is_recurring": is_recurring,
                "benefit_id": benefit_id,
                "visibility": visibility,
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
        return parse_response_json(response, ListResourceProduct, method_errors)

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[ProductCreateRecurring],
    ) -> Product: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[ProductCreateOneTime],
    ) -> Product: ...

    def create(
        self,
        **kwargs: typing.Any,
    ) -> Product:
        """
        Create a product.

        **Scopes**: `products:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/products/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Product, method_errors)

    def get(
        self,
        id: str,
    ) -> Product:
        """
        Get a product by ID.

        **Scopes**: `products:read` `products:write`

        Args:
            id:

        Raises:
            ResourceNotFound: Product not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/products/{id}",
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
        return parse_response_json(response, Product, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[ProductUpdate],
    ) -> Product:
        """
        Update a product.

        **Scopes**: `products:write`

        Args:
            id:
            **kwargs: Request body parameters

        Raises:
            NotPermitted: You don't have the permission to update this product.
            ResourceNotFound: Product not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/products/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Product, method_errors)

    def update_benefits(
        self,
        id: str,
        **kwargs: typing.Unpack[ProductBenefitsUpdate],
    ) -> Product:
        """
        Update benefits granted by a product.

        **Scopes**: `products:write`

        Args:
            id:
            **kwargs: Request body parameters

        Raises:
            NotPermitted: You don't have the permission to update this product.
            ResourceNotFound: Product not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/products/{id}/benefits",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Product, method_errors)


class ProductsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        id: str | builtins.list[str] | None = None,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        is_archived: bool | None = None,
        is_recurring: bool | None = None,
        benefit_id: str | builtins.list[str] | None = None,
        visibility: builtins.list[ProductVisibility] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[ProductSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
    ) -> ListResourceProduct:
        """
        List products.

        **Scopes**: `products:read` `products:write`

        Args:
            id: Filter by product ID.
            organization_id: Filter by organization ID.
            query: Filter by product name.
            is_archived: Filter on archived products.
            is_recurring: Filter on recurring products. If `true`, only subscriptions tiers are returned. If `false`, only one-time purchase products are returned.
            benefit_id: Filter products granting specific benefit.
            visibility: Filter by visibility.
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
            url="/v1/products/",
            path_params={},
            query_params={
                "id": id,
                "organization_id": organization_id,
                "query": query,
                "is_archived": is_archived,
                "is_recurring": is_recurring,
                "benefit_id": benefit_id,
                "visibility": visibility,
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
        return parse_response_json(response, ListResourceProduct, method_errors)

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[ProductCreateRecurring],
    ) -> Product: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[ProductCreateOneTime],
    ) -> Product: ...

    async def create(
        self,
        **kwargs: typing.Any,
    ) -> Product:
        """
        Create a product.

        **Scopes**: `products:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/products/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Product, method_errors)

    async def get(
        self,
        id: str,
    ) -> Product:
        """
        Get a product by ID.

        **Scopes**: `products:read` `products:write`

        Args:
            id:

        Raises:
            ResourceNotFound: Product not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/products/{id}",
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
        return parse_response_json(response, Product, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[ProductUpdate],
    ) -> Product:
        """
        Update a product.

        **Scopes**: `products:write`

        Args:
            id:
            **kwargs: Request body parameters

        Raises:
            NotPermitted: You don't have the permission to update this product.
            ResourceNotFound: Product not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/products/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Product, method_errors)

    async def update_benefits(
        self,
        id: str,
        **kwargs: typing.Unpack[ProductBenefitsUpdate],
    ) -> Product:
        """
        Update benefits granted by a product.

        **Scopes**: `products:write`

        Args:
            id:
            **kwargs: Request body parameters

        Raises:
            NotPermitted: You don't have the permission to update this product.
            ResourceNotFound: Product not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/products/{id}/benefits",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Product, method_errors)
