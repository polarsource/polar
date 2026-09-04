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
    HTTPValidationError,
    ResourceNotFound,
)
from polar.v2026_10.literals import (
    CustomerWalletSortProperty,
)
from polar.v2026_10.outputs import (
    CustomerWallet,
    ListResourceCustomerWallet,
)


class WalletsSync(SyncServiceBase):
    def list(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerWalletSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceCustomerWallet:
        """
        List wallets of the authenticated customer.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
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
            url="/v1/customer-portal/wallets/",
            path_params={},
            query_params={
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomerWallet, method_errors)

    def iter_list(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerWalletSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[CustomerWallet, None, None]:
        """
        List wallets of the authenticated customer.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            A generator that yields items of type CustomerWallet.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                page=page,
                limit=limit,
                sorting=sorting,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerWallet:
        """
        Get a wallet by ID for the authenticated customer.

        Args:
            id: The wallet ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Wallet not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/wallets/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerWallet, method_errors)


class WalletsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerWalletSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceCustomerWallet:
        """
        List wallets of the authenticated customer.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
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
            url="/v1/customer-portal/wallets/",
            path_params={},
            query_params={
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomerWallet, method_errors)

    async def iter_list(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerWalletSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[CustomerWallet, None]:
        """
        List wallets of the authenticated customer.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            An async generator that yields items of type CustomerWallet.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                page=page,
                limit=limit,
                sorting=sorting,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerWallet:
        """
        Get a wallet by ID for the authenticated customer.

        Args:
            id: The wallet ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Wallet not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/wallets/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerWallet, method_errors)
