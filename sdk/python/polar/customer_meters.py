from __future__ import annotations

import builtins

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.literals import (
    CustomerMeterSortProperty,
)
from polar.outputs import (
    CustomerMeter,
    ListResourceCustomerMeter,
)


class CustomerMetersSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        meter_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerMeterSortProperty] | None = ["-modified_at"],
    ) -> ListResourceCustomerMeter:
        """
        List customer meters.

        **Scopes**: `customer_meters:read`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            meter_id: Filter by meter ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-meters/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "meter_id": meter_id,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceCustomerMeter, method_errors)

    def get(
        self,
        id: str,
    ) -> CustomerMeter:
        """
        Get a customer meter by ID.

        **Scopes**: `customer_meters:read`

        Args:
            id: The customer meter ID.

        Raises:
            ResourceNotFound: Customer meter not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-meters/{id}",
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
        return parse_response(response, CustomerMeter, method_errors)


class CustomerMetersAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        meter_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerMeterSortProperty] | None = ["-modified_at"],
    ) -> ListResourceCustomerMeter:
        """
        List customer meters.

        **Scopes**: `customer_meters:read`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            meter_id: Filter by meter ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-meters/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "meter_id": meter_id,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceCustomerMeter, method_errors)

    async def get(
        self,
        id: str,
    ) -> CustomerMeter:
        """
        Get a customer meter by ID.

        **Scopes**: `customer_meters:read`

        Args:
            id: The customer meter ID.

        Raises:
            ResourceNotFound: Customer meter not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-meters/{id}",
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
        return parse_response(response, CustomerMeter, method_errors)
