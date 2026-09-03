from __future__ import annotations

import builtins
import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2026_04.errors import (
    HTTPValidationError,
)
from polar.v2026_04.outputs import (
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceDownloadableRead:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by benefit ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[DownloadableRead, None, None]:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by benefit ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.



        Returns:
            A generator that yields items of type DownloadableRead.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                benefit_id=benefit_id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            request_access_token=request_access_token,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1


class DownloadablesAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        benefit_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceDownloadableRead:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by benefit ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[DownloadableRead, None]:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by benefit ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.



        Returns:
            An async generator that yields items of type DownloadableRead.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                benefit_id=benefit_id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            request_access_token=request_access_token,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1
