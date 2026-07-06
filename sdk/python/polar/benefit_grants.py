from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
)
from polar.literals import (
    BenefitGrantSortProperty,
)
from polar.outputs import (
    BenefitGrant,
    ListResourceBenefitGrant,
)


class BenefitGrantsSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        is_granted: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitGrantSortProperty] | None = ["-created_at"],
    ) -> ListResourceBenefitGrant:
        """
        List benefit grants across all benefits accessible to the authenticated subject.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefit-grants/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "is_granted": is_granted,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceBenefitGrant, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        is_granted: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitGrantSortProperty] | None = ["-created_at"],
    ) -> typing.Generator[BenefitGrant, None, None]:
        """
        List benefit grants across all benefits accessible to the authenticated subject.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            A generator that yields items of type BenefitGrant.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                is_granted=is_granted,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1


class BenefitGrantsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        is_granted: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitGrantSortProperty] | None = ["-created_at"],
    ) -> ListResourceBenefitGrant:
        """
        List benefit grants across all benefits accessible to the authenticated subject.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefit-grants/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "is_granted": is_granted,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceBenefitGrant, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        is_granted: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitGrantSortProperty] | None = ["-created_at"],
    ) -> typing.AsyncGenerator[BenefitGrant, None]:
        """
        List benefit grants across all benefits accessible to the authenticated subject.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            An async generator that yields items of type BenefitGrant.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                is_granted=is_granted,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1
