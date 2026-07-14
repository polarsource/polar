from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.v2026_04.errors import (
    HTTPValidationError,
    Update404Error,
)
from polar.v2026_04.inputs import (
    EventTypeUpdate,
)
from polar.v2026_04.literals import (
    EventSource,
    EventTypesSortProperty,
)
from polar.v2026_04.outputs import (
    EventType,
    EventTypeWithStats,
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
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
        return parse_response_json(
            response, ListResourceEventTypeWithStats, method_errors
        )

    def iter_list(
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
    ) -> typing.Generator[EventTypeWithStats, None, None]:
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

        Returns:
            A generator that yields items of type EventTypeWithStats.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                query=query,
                root_events=root_events,
                parent_id=parent_id,
                source=source,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

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
            **kwargs: Request body parameters

        Raises:
            Update404Error: Not Found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
        return parse_response_json(response, EventType, method_errors)


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
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
        return parse_response_json(
            response, ListResourceEventTypeWithStats, method_errors
        )

    async def iter_list(
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
    ) -> typing.AsyncGenerator[EventTypeWithStats, None]:
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

        Returns:
            An async generator that yields items of type EventTypeWithStats.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                query=query,
                root_events=root_events,
                parent_id=parent_id,
                source=source,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

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
            **kwargs: Request body parameters

        Raises:
            Update404Error: Not Found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
        return parse_response_json(response, EventType, method_errors)
