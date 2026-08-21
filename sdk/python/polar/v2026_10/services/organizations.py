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
    CannotCreateOrganizationError,
    HTTPValidationError,
    OrganizationsUpdate403Error,
    ResourceNotFound,
    SSOEnforcementRequiresConnection,
)
from polar.v2026_10.inputs import (
    OrganizationCreate,
    OrganizationUpdate,
)
from polar.v2026_10.literals import (
    OrganizationSortProperty,
)
from polar.v2026_10.outputs import (
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
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceOrganization:
        """
        List organizations.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            slug: Filter by slug.
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
            url="/v1/organizations/",
            path_params={},
            query_params={
                "slug": slug,
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
        return parse_response_json(response, ListResourceOrganization, method_errors)

    def iter_list(
        self,
        *,
        slug: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrganizationSortProperty] | None = ["created_at"],
        request_timeout: RequestTimeout | None = None,
    ) -> typing.Generator[Organization, None, None]:
        """
        List organizations.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            slug: Filter by slug.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            A generator that yields items of type Organization.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                slug=slug,
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
        **kwargs: typing.Unpack[OrganizationCreate],
    ) -> Organization:
        """
        Create an organization.

        **Scopes**: `organizations:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            CannotCreateOrganizationError: Forbidden
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/organizations/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: CannotCreateOrganizationError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Organization, method_errors)

    def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> Organization:
        """
        Get an organization by ID.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Organization not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/organizations/{id}",
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
        return parse_response_json(response, Organization, method_errors)

    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[OrganizationUpdate],
    ) -> Organization:
        """
        Update an organization.

        **Scopes**: `organizations:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            OrganizationsUpdate403Error: You don't have the permission to update this organization, or dispute auto-accept isn't enabled for it.
            ResourceNotFound: Organization not found.
            SSOEnforcementRequiresConnection: Cannot enforce SSO without an enabled connection.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/organizations/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: OrganizationsUpdate403Error,
            404: ResourceNotFound,
            409: SSOEnforcementRequiresConnection,
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
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceOrganization:
        """
        List organizations.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            slug: Filter by slug.
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
            url="/v1/organizations/",
            path_params={},
            query_params={
                "slug": slug,
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
        return parse_response_json(response, ListResourceOrganization, method_errors)

    async def iter_list(
        self,
        *,
        slug: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrganizationSortProperty] | None = ["created_at"],
        request_timeout: RequestTimeout | None = None,
    ) -> typing.AsyncGenerator[Organization, None]:
        """
        List organizations.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            slug: Filter by slug.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            An async generator that yields items of type Organization.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                slug=slug,
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
        **kwargs: typing.Unpack[OrganizationCreate],
    ) -> Organization:
        """
        Create an organization.

        **Scopes**: `organizations:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            CannotCreateOrganizationError: Forbidden
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/organizations/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: CannotCreateOrganizationError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Organization, method_errors)

    async def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> Organization:
        """
        Get an organization by ID.

        **Scopes**: `organizations:read` `organizations:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Organization not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/organizations/{id}",
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
        return parse_response_json(response, Organization, method_errors)

    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[OrganizationUpdate],
    ) -> Organization:
        """
        Update an organization.

        **Scopes**: `organizations:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            OrganizationsUpdate403Error: You don't have the permission to update this organization, or dispute auto-accept isn't enabled for it.
            ResourceNotFound: Organization not found.
            SSOEnforcementRequiresConnection: Cannot enforce SSO without an enabled connection.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/organizations/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: OrganizationsUpdate403Error,
            404: ResourceNotFound,
            409: SSOEnforcementRequiresConnection,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Organization, method_errors)
