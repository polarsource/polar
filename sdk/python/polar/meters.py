from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.inputs import (
    MetadataQuery,
    MeterCreate,
    MeterUpdate,
)
from polar.literals import (
    AggregationFunction,
    MeterSortProperty,
    TimeInterval,
    Timezone,
)
from polar.outputs import (
    ListResourceMeter,
    Meter,
    MeterQuantities,
)


class MetersSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        is_archived: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[MeterSortProperty] | None = ["name"],
        metadata: MetadataQuery = None,
    ) -> ListResourceMeter:
        """
        List meters.

        **Scopes**: `meters:read` `meters:write`

        Args:
            organization_id: Filter by organization ID.
            query: Filter by name.
            is_archived: Filter on archived meters.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/meters/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "query": query,
                "is_archived": is_archived,
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
        return parse_response(response, ListResourceMeter, method_errors)

    def create(
        self,
        **kwargs: typing.Unpack[MeterCreate],
    ) -> Meter:
        """
        Create a meter.

        **Scopes**: `meters:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/meters/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Meter, method_errors)

    def get(
        self,
        id: str,
    ) -> Meter:
        """
        Get a meter by ID.

        **Scopes**: `meters:read` `meters:write`

        Args:
            id: The meter ID.

        Raises:
            ResourceNotFound: Meter not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/meters/{id}",
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
        return parse_response(response, Meter, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[MeterUpdate],
    ) -> Meter:
        """
        Update a meter.

        **Scopes**: `meters:write`

        Args:
            id: The meter ID.

        Raises:
            ResourceNotFound: Meter not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/meters/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Meter, method_errors)

    def quantities(
        self,
        id: str,
        *,
        start_timestamp: str,
        end_timestamp: str,
        interval: TimeInterval,
        timezone: Timezone = "UTC",
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        customer_aggregation_function: AggregationFunction | None = None,
        metadata: MetadataQuery = None,
    ) -> MeterQuantities:
        """
        Get quantities of a meter over a time period.

        **Scopes**: `meters:read` `meters:write`

        Args:
            id: The meter ID.
            start_timestamp: Start timestamp.
            end_timestamp: End timestamp.
            interval: Interval between two timestamps.
            timezone: Timezone to use for the timestamps. Default is UTC.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            customer_aggregation_function: If set, will first compute the quantities per customer before aggregating them using the given function. If not set, the quantities will be aggregated across all events.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            ResourceNotFound: Meter not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/meters/{id}/quantities",
            path_params={
                "id": id,
            },
            query_params={
                "start_timestamp": start_timestamp,
                "end_timestamp": end_timestamp,
                "interval": interval,
                "timezone": timezone,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "customer_aggregation_function": customer_aggregation_function,
                "metadata": metadata,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, MeterQuantities, method_errors)


class MetersAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        is_archived: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[MeterSortProperty] | None = ["name"],
        metadata: MetadataQuery = None,
    ) -> ListResourceMeter:
        """
        List meters.

        **Scopes**: `meters:read` `meters:write`

        Args:
            organization_id: Filter by organization ID.
            query: Filter by name.
            is_archived: Filter on archived meters.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/meters/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "query": query,
                "is_archived": is_archived,
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
        return parse_response(response, ListResourceMeter, method_errors)

    async def create(
        self,
        **kwargs: typing.Unpack[MeterCreate],
    ) -> Meter:
        """
        Create a meter.

        **Scopes**: `meters:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/meters/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Meter, method_errors)

    async def get(
        self,
        id: str,
    ) -> Meter:
        """
        Get a meter by ID.

        **Scopes**: `meters:read` `meters:write`

        Args:
            id: The meter ID.

        Raises:
            ResourceNotFound: Meter not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/meters/{id}",
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
        return parse_response(response, Meter, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[MeterUpdate],
    ) -> Meter:
        """
        Update a meter.

        **Scopes**: `meters:write`

        Args:
            id: The meter ID.

        Raises:
            ResourceNotFound: Meter not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/meters/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Meter, method_errors)

    async def quantities(
        self,
        id: str,
        *,
        start_timestamp: str,
        end_timestamp: str,
        interval: TimeInterval,
        timezone: Timezone = "UTC",
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        customer_aggregation_function: AggregationFunction | None = None,
        metadata: MetadataQuery = None,
    ) -> MeterQuantities:
        """
        Get quantities of a meter over a time period.

        **Scopes**: `meters:read` `meters:write`

        Args:
            id: The meter ID.
            start_timestamp: Start timestamp.
            end_timestamp: End timestamp.
            interval: Interval between two timestamps.
            timezone: Timezone to use for the timestamps. Default is UTC.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by external customer ID.
            customer_aggregation_function: If set, will first compute the quantities per customer before aggregating them using the given function. If not set, the quantities will be aggregated across all events.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            ResourceNotFound: Meter not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/meters/{id}/quantities",
            path_params={
                "id": id,
            },
            query_params={
                "start_timestamp": start_timestamp,
                "end_timestamp": end_timestamp,
                "interval": interval,
                "timezone": timezone,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "customer_aggregation_function": customer_aggregation_function,
                "metadata": metadata,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, MeterQuantities, method_errors)
