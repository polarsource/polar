from __future__ import annotations

import builtins

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
)
from polar.outputs import (
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
