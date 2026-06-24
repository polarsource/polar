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
    OrganizationCreate,
    OrganizationUpdate,
)
from polar.literals import (
    OrganizationSortProperty,
)
from polar.outputs import (
    ListResourceOrganization,
    Organization,
)


class OrganizationsSync(SyncServiceBase):
    def list(
        self,
        *,
        slug: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrganizationSortProperty] | None = ["created_at"],
    ) -> ListResourceOrganization:
        """
        List organizations.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            slug: Filter by slug.
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
            url="/v1/organizations/",
            path_params={},
            query_params={
                "slug": slug,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceOrganization, method_errors)

    def create(
        self,
        **kwargs: typing.Unpack[OrganizationCreate],
    ) -> Organization:
        """
        Create an organization.

        **Scopes**: `organizations:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/organizations/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Organization, method_errors)

    def get(
        self,
        id: str,
    ) -> Organization:
        """
        Get an organization by ID.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Organization not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/organizations/{id}",
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
        return parse_response_json(response, Organization, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[OrganizationUpdate],
    ) -> Organization:
        """
        Update an organization.

        **Scopes**: `organizations:write`

        Args:
            id: None

        Raises:
            NotPermitted: You don't have the permission to update this organization.
            ResourceNotFound: Organization not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/organizations/{id}",
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
        return parse_response_json(response, Organization, method_errors)


class OrganizationsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        slug: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrganizationSortProperty] | None = ["created_at"],
    ) -> ListResourceOrganization:
        """
        List organizations.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            slug: Filter by slug.
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
            url="/v1/organizations/",
            path_params={},
            query_params={
                "slug": slug,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceOrganization, method_errors)

    async def create(
        self,
        **kwargs: typing.Unpack[OrganizationCreate],
    ) -> Organization:
        """
        Create an organization.

        **Scopes**: `organizations:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/organizations/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Organization, method_errors)

    async def get(
        self,
        id: str,
    ) -> Organization:
        """
        Get an organization by ID.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Organization not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/organizations/{id}",
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
        return parse_response_json(response, Organization, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[OrganizationUpdate],
    ) -> Organization:
        """
        Update an organization.

        **Scopes**: `organizations:write`

        Args:
            id: None

        Raises:
            NotPermitted: You don't have the permission to update this organization.
            ResourceNotFound: Organization not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/organizations/{id}",
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
        return parse_response_json(response, Organization, method_errors)
