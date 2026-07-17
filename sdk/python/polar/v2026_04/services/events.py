from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.v2026_04.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.v2026_04.inputs import (
    EventsIngest,
    MetadataQuery,
)
from polar.v2026_04.literals import (
    EventNamesSortProperty,
    EventSortProperty,
    EventSource,
)
from polar.v2026_04.outputs import (
    Event,
    EventName,
    EventsIngestResponse,
    ListResourceEvent,
    ListResourceEventName,
    ListResourceWithCursorPaginationEvent,
)


class EventsSync(SyncServiceBase):
    def list(
        self,
        *,
        filter: str | None = None,
        start_timestamp: str | None = None,
        end_timestamp: str | None = None,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        meter_id: str | None = None,
        name: str | builtins.list[str] | None = None,
        source: EventSource | builtins.list[EventSource] | None = None,
        query: str | None = None,
        parent_id: str | None = None,
        depth: int | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[EventSortProperty] | None = ["-timestamp"],
        metadata: MetadataQuery = None,
    ) -> ListResourceEvent | ListResourceWithCursorPaginationEvent:
        """
        List events.

        **Scopes**: `events:read` `events:write`

        Args:
            filter: Filter events following filter clauses. JSON string following the same schema a meter filter clause.
            start_timestamp: Filter events after this timestamp.
            end_timestamp: Filter events before this timestamp.
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            meter_id: Filter by a meter filter clause.
            name: Filter by event name.
            source: Filter by event source.
            query: Query to filter events.
            parent_id: When combined with depth, use this event as the anchor instead of root events.
            depth: Fetch descendants up to this depth. When set: 0=root events only, 1=roots+children, etc. Max 5. When not set, returns all events.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/events/",
            path_params={},
            query_params={
                "filter": filter,
                "start_timestamp": start_timestamp,
                "end_timestamp": end_timestamp,
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "meter_id": meter_id,
                "name": name,
                "source": source,
                "query": query,
                "parent_id": parent_id,
                "depth": depth,
                "page": page,
                "limit": limit,
                "sorting": sorting,
                "metadata": metadata,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(
            response,
            ListResourceEvent | ListResourceWithCursorPaginationEvent,
            method_errors,
        )

    def list_names(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        source: EventSource | builtins.list[EventSource] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[EventNamesSortProperty] | None = ["-last_seen"],
    ) -> ListResourceEventName:
        """
        List event names.

        **Scopes**: `events:read` `events:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            source: Filter by event source.
            query: Query to filter event names.
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
            url="/v1/events/names",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "source": source,
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
        return parse_response_json(response, ListResourceEventName, method_errors)

    def iter_list_names(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        source: EventSource | builtins.list[EventSource] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[EventNamesSortProperty] | None = ["-last_seen"],
    ) -> typing.Generator[EventName, None, None]:
        """
        List event names.

        **Scopes**: `events:read` `events:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            source: Filter by event source.
            query: Query to filter event names.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            A generator that yields items of type EventName.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_names(
                organization_id=organization_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                source=source,
                query=query,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def get(
        self,
        id: str,
    ) -> Event:
        """
        Get an event by ID.

        **Scopes**: `events:read` `events:write`

        Args:
            id: The event ID.

        Raises:
            ResourceNotFound: Event not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/events/{id}",
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
        return parse_response_json(response, Event, method_errors)

    def ingest(
        self,
        **kwargs: typing.Unpack[EventsIngest],
    ) -> EventsIngestResponse:
        """
        Ingest batch of events.

        **Scopes**: `events:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/events/ingest",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, EventsIngestResponse, method_errors)


class EventsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        filter: str | None = None,
        start_timestamp: str | None = None,
        end_timestamp: str | None = None,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        meter_id: str | None = None,
        name: str | builtins.list[str] | None = None,
        source: EventSource | builtins.list[EventSource] | None = None,
        query: str | None = None,
        parent_id: str | None = None,
        depth: int | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[EventSortProperty] | None = ["-timestamp"],
        metadata: MetadataQuery = None,
    ) -> ListResourceEvent | ListResourceWithCursorPaginationEvent:
        """
        List events.

        **Scopes**: `events:read` `events:write`

        Args:
            filter: Filter events following filter clauses. JSON string following the same schema a meter filter clause.
            start_timestamp: Filter events after this timestamp.
            end_timestamp: Filter events before this timestamp.
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            meter_id: Filter by a meter filter clause.
            name: Filter by event name.
            source: Filter by event source.
            query: Query to filter events.
            parent_id: When combined with depth, use this event as the anchor instead of root events.
            depth: Fetch descendants up to this depth. When set: 0=root events only, 1=roots+children, etc. Max 5. When not set, returns all events.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/events/",
            path_params={},
            query_params={
                "filter": filter,
                "start_timestamp": start_timestamp,
                "end_timestamp": end_timestamp,
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "meter_id": meter_id,
                "name": name,
                "source": source,
                "query": query,
                "parent_id": parent_id,
                "depth": depth,
                "page": page,
                "limit": limit,
                "sorting": sorting,
                "metadata": metadata,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(
            response,
            ListResourceEvent | ListResourceWithCursorPaginationEvent,
            method_errors,
        )

    async def list_names(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        source: EventSource | builtins.list[EventSource] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[EventNamesSortProperty] | None = ["-last_seen"],
    ) -> ListResourceEventName:
        """
        List event names.

        **Scopes**: `events:read` `events:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            source: Filter by event source.
            query: Query to filter event names.
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
            url="/v1/events/names",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "source": source,
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
        return parse_response_json(response, ListResourceEventName, method_errors)

    async def iter_list_names(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        source: EventSource | builtins.list[EventSource] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[EventNamesSortProperty] | None = ["-last_seen"],
    ) -> typing.AsyncGenerator[EventName, None]:
        """
        List event names.

        **Scopes**: `events:read` `events:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            source: Filter by event source.
            query: Query to filter event names.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Returns:
            An async generator that yields items of type EventName.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_names(
                organization_id=organization_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                source=source,
                query=query,
                page=page,
                limit=limit,
                sorting=sorting,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def get(
        self,
        id: str,
    ) -> Event:
        """
        Get an event by ID.

        **Scopes**: `events:read` `events:write`

        Args:
            id: The event ID.

        Raises:
            ResourceNotFound: Event not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/events/{id}",
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
        return parse_response_json(response, Event, method_errors)

    async def ingest(
        self,
        **kwargs: typing.Unpack[EventsIngest],
    ) -> EventsIngestResponse:
        """
        Ingest batch of events.

        **Scopes**: `events:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/events/ingest",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, EventsIngestResponse, method_errors)
