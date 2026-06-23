from __future__ import annotations

import builtins

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.literals import (
    CustomerCustomerMeterSortProperty,
)
from polar.outputs import (
    CustomerCustomerMeter,
    ListResourceCustomerCustomerMeter,
)


class CustomerMetersSync(SyncServiceBase):
    def list(
        self,
        *,
        meter_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerCustomerMeterSortProperty] | None = [
            "-modified_at"
        ],
    ) -> ListResourceCustomerCustomerMeter:
        """
        List meters of the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            meter_id: Filter by meter ID.
            query: Filter by meter name.
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
            url="/v1/customer-portal/meters/",
            path_params={},
            query_params={
                "meter_id": meter_id,
                "query": query,
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
            response, ListResourceCustomerCustomerMeter, method_errors
        )

    def get(
        self,
        id: str,
    ) -> CustomerCustomerMeter:
        """
        Get a meter by ID for the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: The customer meter ID.

        Raises:
            ResourceNotFound: Customer meter not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/meters/{id}",
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
        return parse_response(response, CustomerCustomerMeter, method_errors)


class CustomerMetersAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        meter_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerCustomerMeterSortProperty] | None = [
            "-modified_at"
        ],
    ) -> ListResourceCustomerCustomerMeter:
        """
        List meters of the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            meter_id: Filter by meter ID.
            query: Filter by meter name.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/meters/",
            path_params={},
            query_params={
                "meter_id": meter_id,
                "query": query,
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
            response, ListResourceCustomerCustomerMeter, method_errors
        )

    async def get(
        self,
        id: str,
    ) -> CustomerCustomerMeter:
        """
        Get a meter by ID for the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: The customer meter ID.

        Raises:
            ResourceNotFound: Customer meter not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/meters/{id}",
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
        return parse_response(response, CustomerCustomerMeter, method_errors)
