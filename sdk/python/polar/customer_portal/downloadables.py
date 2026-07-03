from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
)
from polar.outputs import (
    DownloadableRead,
    ListResourceDownloadableRead,
)


class DownloadablesSync(SyncServiceBase):
    def list(
        self,
        *,
        benefit_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceDownloadableRead:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by benefit ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/downloadables/",
            path_params={},
            query_params={
                "benefit_id": benefit_id,
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceDownloadableRead, method_errors
        )

    def iter_list(
        self,
        *,
        benefit_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> typing.Generator[DownloadableRead]:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by benefit ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type DownloadableRead.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                benefit_id=benefit_id,
                page=page,
                limit=limit,
            )
            yield from response.items
            if page == response.pagination.max_page:
                break
            page += 1


class DownloadablesAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        benefit_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceDownloadableRead:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by benefit ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/downloadables/",
            path_params={},
            query_params={
                "benefit_id": benefit_id,
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceDownloadableRead, method_errors
        )

    async def iter_list(
        self,
        *,
        benefit_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> typing.AsyncGenerator[DownloadableRead]:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by benefit ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type DownloadableRead.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                benefit_id=benefit_id,
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page == response.pagination.max_page:
                break
            page += 1
