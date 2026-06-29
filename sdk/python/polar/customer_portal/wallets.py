from __future__ import annotations

import builtins

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.literals import (
    CustomerWalletSortProperty,
)
from polar.outputs import (
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
    ) -> ListResourceCustomerWallet:
        """
        List wallets of the authenticated customer.

        Args:
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
            url="/v1/customer-portal/wallets/",
            path_params={},
            query_params={
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomerWallet, method_errors)

    def get(
        self,
        id: str,
    ) -> CustomerWallet:
        """
        Get a wallet by ID for the authenticated customer.

        Args:
            id: The wallet ID.

        Raises:
            ResourceNotFound: Wallet not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/wallets/{id}",
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
        return parse_response_json(response, CustomerWallet, method_errors)


class WalletsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerWalletSortProperty] | None = ["-created_at"],
    ) -> ListResourceCustomerWallet:
        """
        List wallets of the authenticated customer.

        Args:
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
            url="/v1/customer-portal/wallets/",
            path_params={},
            query_params={
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomerWallet, method_errors)

    async def get(
        self,
        id: str,
    ) -> CustomerWallet:
        """
        Get a wallet by ID for the authenticated customer.

        Args:
            id: The wallet ID.

        Raises:
            ResourceNotFound: Wallet not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/wallets/{id}",
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
        return parse_response_json(response, CustomerWallet, method_errors)
