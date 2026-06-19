from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
    Update404Error,
)
from polar.inputs import (
    EventTypeUpdate,
)
from polar.literals import (
    EventSource,
    EventTypesSortProperty,
)
from polar.outputs import (
    EventType,
    ListResourceEventTypeWithStats,
)


class EventTypesSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        root_events: bool = False,
        parent_id: str | None = None,
        source: EventSource | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[EventTypesSortProperty] | None = ["-last_seen"],
    ) -> ListResourceEventTypeWithStats:
        """
        List event types with aggregated statistics.

        **Scopes**: `events:read` `events:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            query: Query to filter event types by name or label.
            root_events: When true, only return event types with root events (parent_id IS NULL).
            parent_id: Filter by specific parent event ID.
            source: Filter by event source (system or user).
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/event-types/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "query": query,
                "root_events": root_events,
                "parent_id": parent_id,
                "source": source,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceEventTypeWithStats, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[EventTypeUpdate],
    ) -> EventType:
        """
        Update an event type's label.

        **Scopes**: `events:write`

        Args:
            id: The event type ID.

        Raises:
            Update404Error: Not Found
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/event-types/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: Update404Error,
            422: HTTPValidationError,
        }
        return parse_response(response, EventType, method_errors)


class EventTypesAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        root_events: bool = False,
        parent_id: str | None = None,
        source: EventSource | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[EventTypesSortProperty] | None = ["-last_seen"],
    ) -> ListResourceEventTypeWithStats:
        """
        List event types with aggregated statistics.

        **Scopes**: `events:read` `events:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            query: Query to filter event types by name or label.
            root_events: When true, only return event types with root events (parent_id IS NULL).
            parent_id: Filter by specific parent event ID.
            source: Filter by event source (system or user).
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/event-types/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "query": query,
                "root_events": root_events,
                "parent_id": parent_id,
                "source": source,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceEventTypeWithStats, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[EventTypeUpdate],
    ) -> EventType:
        """
        Update an event type's label.

        **Scopes**: `events:write`

        Args:
            id: The event type ID.

        Raises:
            Update404Error: Not Found
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/event-types/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: Update404Error,
            422: HTTPValidationError,
        }
        return parse_response(response, EventType, method_errors)
