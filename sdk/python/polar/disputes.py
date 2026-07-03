from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    DisputeNotOpenError,
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

        **Scopes**: `disputes:read` `disputes:write`

        Args:
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            status: Filter by dispute status.
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
        return parse_response_json(response, ListResourceDispute, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        status: DisputeStatus | builtins.list[DisputeStatus] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[DisputeSortProperty] | None = ["-created_at"],
    ) -> typing.Generator[Dispute]:
        """
        List disputes.

        **Scopes**: `disputes:read` `disputes:write`

        Args:
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            status: Filter by dispute status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            A generator that yields items of type Dispute.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                order_id=order_id,
                status=status,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            yield from response.items
            if page == response.pagination.max_page:
                break
            page += 1

    def get(
        self,
        id: str,
    ) -> Dispute:
        """
        Get a dispute by ID.

        **Scopes**: `disputes:read` `disputes:write`

        Args:
            id: The dispute ID.

        Raises:
            ResourceNotFound: Dispute not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
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
        return parse_response_json(response, Dispute, method_errors)

    def accept(
        self,
        id: str,
    ) -> Dispute:
        """
        Accept a dispute, conceding the chargeback.

        Closes the dispute with the processor (settling it as `lost`) and records
        the merchant's decision on the dispute's support case.

        **Scopes**: `disputes:write`

        Args:
            id: The dispute ID.

        Raises:
            ResourceNotFound: Dispute not found.
            DisputeNotOpenError: Conflict
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/disputes/{id}/accept",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: DisputeNotOpenError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Dispute, method_errors)


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

        **Scopes**: `disputes:read` `disputes:write`

        Args:
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            status: Filter by dispute status.
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
        return parse_response_json(response, ListResourceDispute, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        status: DisputeStatus | builtins.list[DisputeStatus] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[DisputeSortProperty] | None = ["-created_at"],
    ) -> typing.AsyncGenerator[Dispute]:
        """
        List disputes.

        **Scopes**: `disputes:read` `disputes:write`

        Args:
            organization_id: Filter by organization ID.
            order_id: Filter by order ID.
            status: Filter by dispute status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            An async generator that yields items of type Dispute.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                order_id=order_id,
                status=status,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            for item in response.items:
                yield item
            if page == response.pagination.max_page:
                break
            page += 1

    async def get(
        self,
        id: str,
    ) -> Dispute:
        """
        Get a dispute by ID.

        **Scopes**: `disputes:read` `disputes:write`

        Args:
            id: The dispute ID.

        Raises:
            ResourceNotFound: Dispute not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
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
        return parse_response_json(response, Dispute, method_errors)

    async def accept(
        self,
        id: str,
    ) -> Dispute:
        """
        Accept a dispute, conceding the chargeback.

        Closes the dispute with the processor (settling it as `lost`) and records
        the merchant's decision on the dispute's support case.

        **Scopes**: `disputes:write`

        Args:
            id: The dispute ID.

        Raises:
            ResourceNotFound: Dispute not found.
            DisputeNotOpenError: Conflict
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/disputes/{id}/accept",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: DisputeNotOpenError,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Dispute, method_errors)
