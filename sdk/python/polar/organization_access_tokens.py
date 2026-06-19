from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
)
from polar.inputs import (
    OrganizationAccessTokenCreate,
    OrganizationAccessTokenUpdate,
)
from polar.literals import (
    OrganizationAccessTokenSortProperty,
)
from polar.outputs import (
    ListResourceOrganizationAccessToken,
    OrganizationAccessToken,
    OrganizationAccessTokenCreateResponse,
)


class OrganizationAccessTokensSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrganizationAccessTokenSortProperty] | None = [
            "created_at"
        ],
    ) -> ListResourceOrganizationAccessToken:
        """
        List organization access tokens.

        **Scopes**: `organization_access_tokens:read` `organization_access_tokens:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/organization-access-tokens/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(
            response, ListResourceOrganizationAccessToken, method_errors
        )

    def create(
        self,
        **kwargs: typing.Unpack[OrganizationAccessTokenCreate],
    ) -> OrganizationAccessTokenCreateResponse:
        """
        **Scopes**: `organization_access_tokens:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/organization-access-tokens/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(
            response, OrganizationAccessTokenCreateResponse, method_errors
        )

    def delete(
        self,
        id: str,
    ) -> typing.Any:
        """
        **Scopes**: `organization_access_tokens:write`

        Args:
            id: None

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/organization-access-tokens/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[OrganizationAccessTokenUpdate],
    ) -> OrganizationAccessToken:
        """
        **Scopes**: `organization_access_tokens:write`

        Args:
            id: None

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/organization-access-tokens/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, OrganizationAccessToken, method_errors)


class OrganizationAccessTokensAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[OrganizationAccessTokenSortProperty] | None = [
            "created_at"
        ],
    ) -> ListResourceOrganizationAccessToken:
        """
        List organization access tokens.

        **Scopes**: `organization_access_tokens:read` `organization_access_tokens:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/organization-access-tokens/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(
            response, ListResourceOrganizationAccessToken, method_errors
        )

    async def create(
        self,
        **kwargs: typing.Unpack[OrganizationAccessTokenCreate],
    ) -> OrganizationAccessTokenCreateResponse:
        """
        **Scopes**: `organization_access_tokens:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/organization-access-tokens/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(
            response, OrganizationAccessTokenCreateResponse, method_errors
        )

    async def delete(
        self,
        id: str,
    ) -> typing.Any:
        """
        **Scopes**: `organization_access_tokens:write`

        Args:
            id: None

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/organization-access-tokens/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[OrganizationAccessTokenUpdate],
    ) -> OrganizationAccessToken:
        """
        **Scopes**: `organization_access_tokens:write`

        Args:
            id: None

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/organization-access-tokens/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, OrganizationAccessToken, method_errors)
