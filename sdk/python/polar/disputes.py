from __future__ import annotations

import builtins

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.literals import (
    DisputeSortProperty,
    DisputeStatus,
)
from polar.outputs import (
    Dispute,
    ListResourceDispute,
)


class DisputesSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        status: DisputeStatus | builtins.list[DisputeStatus] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[DisputeSortProperty] | None = ["-created_at"],
    ) -> ListResourceDispute:
        """
        List disputes.

        **Scopes**: `disputes:read`

        Args:
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            status: Filter by dispute status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/disputes/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "order_id": order_id,
                "status": status,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceDispute, method_errors)

    def get(
        self,
        id: str,
    ) -> Dispute:
        """
        Get a dispute by ID.

        **Scopes**: `disputes:read`

        Args:
            id: The dispute ID.

        Raises:
            ResourceNotFound: Dispute not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/disputes/{id}",
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
        return parse_response(response, Dispute, method_errors)


class DisputesAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        status: DisputeStatus | builtins.list[DisputeStatus] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[DisputeSortProperty] | None = ["-created_at"],
    ) -> ListResourceDispute:
        """
        List disputes.

        **Scopes**: `disputes:read`

        Args:
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            status: Filter by dispute status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/disputes/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "order_id": order_id,
                "status": status,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceDispute, method_errors)

    async def get(
        self,
        id: str,
    ) -> Dispute:
        """
        Get a dispute by ID.

        **Scopes**: `disputes:read`

        Args:
            id: The dispute ID.

        Raises:
            ResourceNotFound: Dispute not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/disputes/{id}",
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
        return parse_response(response, Dispute, method_errors)
