from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
    parse_response_text,
)
from polar.errors import (
    HTTPValidationError,
)
from polar.inputs import (
    MetricDashboardCreate,
    MetricDashboardUpdate,
)
from polar.literals import (
    ProductBillingType,
    TimeInterval,
    Timezone,
)
from polar.outputs import (
    MetricDashboardSchema,
    MetricsLimits,
    MetricsResponse,
)


class MetricsSync(SyncServiceBase):
    def get(
        self,
        *,
        start_date: str,
        end_date: str,
        timezone: Timezone = "UTC",
        interval: TimeInterval,
        organization_id: str | list[str] | None = None,
        product_id: str | list[str] | None = None,
        billing_type: ProductBillingType
        | list[ProductBillingType]
        | None = None,
        customer_id: str | list[str] | None = None,
        metrics: list[str] | None = None,
    ) -> MetricsResponse:
        """
        Get metrics about your orders and subscriptions.

        Currency values are output in cents.

        **Scopes**: `metrics:read`

        Args:
            start_date: Start date.
            end_date: End date.
            timezone: Timezone to use for the timestamps. Default is UTC.
            interval: Interval between two timestamps.
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            billing_type: Filter by billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            customer_id: Filter by customer ID.
            metrics: List of metric slugs to focus on. When provided, only the queries needed for these metrics will be executed, improving performance. If not provided, all metrics are returned.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/",
            path_params={},
            query_params={
                "start_date": start_date,
                "end_date": end_date,
                "timezone": timezone,
                "interval": interval,
                "organization_id": organization_id,
                "product_id": product_id,
                "billing_type": billing_type,
                "customer_id": customer_id,
                "metrics": metrics,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, MetricsResponse, method_errors)

    def export(
        self,
        *,
        start_date: str,
        end_date: str,
        timezone: Timezone = "UTC",
        interval: TimeInterval,
        organization_id: str | list[str] | None = None,
        product_id: str | list[str] | None = None,
        billing_type: ProductBillingType
        | list[ProductBillingType]
        | None = None,
        customer_id: str | list[str] | None = None,
        metrics: list[str] | None = None,
    ) -> str:
        """
        Export metrics as a CSV file.

        **Scopes**: `metrics:read`

        Args:
            start_date: Start date.
            end_date: End date.
            timezone: Timezone to use for the timestamps. Default is UTC.
            interval: Interval between two timestamps.
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            billing_type: Filter by billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            customer_id: Filter by customer ID.
            metrics: List of metric slugs to include in the export. If not provided, all metrics are exported.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/export",
            path_params={},
            query_params={
                "start_date": start_date,
                "end_date": end_date,
                "timezone": timezone,
                "interval": interval,
                "organization_id": organization_id,
                "product_id": product_id,
                "billing_type": billing_type,
                "customer_id": customer_id,
                "metrics": metrics,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_text(response, method_errors)

    def limits(
        self,
    ) -> MetricsLimits:
        """
        Get the interval limits for the metrics endpoint.

        **Scopes**: `metrics:read`

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/limits",
            path_params={},
            query_params={},
        )
        response = self.client.send_request(request)
        return parse_response_json(response, MetricsLimits)

    def list_dashboards(
        self,
        *,
        organization_id: str | list[str] | None = None,
    ) -> list[MetricDashboardSchema]:
        """
        List user-defined metric dashboards.

        **Scopes**: `metrics:read`

        Args:
            organization_id: Filter by organization ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/dashboards",
            path_params={},
            query_params={
                "organization_id": organization_id,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, list[MetricDashboardSchema], method_errors
        )

    def create_dashboard(
        self,
        **kwargs: typing.Unpack[MetricDashboardCreate],
    ) -> MetricDashboardSchema:
        """
        Create a user-defined metric dashboard.

        **Scopes**: `metrics:write`

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
            url="/v1/metrics/dashboards",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, MetricDashboardSchema, method_errors)

    def get_dashboard(
        self,
        id: str,
    ) -> MetricDashboardSchema:
        """
        Get a user-defined metric dashboard by ID.

        **Scopes**: `metrics:read`

        Args:
            id: The metric dashboard ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/dashboards/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, MetricDashboardSchema, method_errors)

    def delete_dashboard(
        self,
        id: str,
    ) -> None:
        """
        Delete a user-defined metric dashboard.

        **Scopes**: `metrics:write`

        Args:
            id: The metric dashboard ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/metrics/dashboards/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    def update_dashboard(
        self,
        id: str,
        **kwargs: typing.Unpack[MetricDashboardUpdate],
    ) -> MetricDashboardSchema:
        """
        Update a user-defined metric dashboard.

        **Scopes**: `metrics:write`

        Args:
            id: The metric dashboard ID.
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/metrics/dashboards/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, MetricDashboardSchema, method_errors)


class MetricsAsync(AsyncServiceBase):
    async def get(
        self,
        *,
        start_date: str,
        end_date: str,
        timezone: Timezone = "UTC",
        interval: TimeInterval,
        organization_id: str | list[str] | None = None,
        product_id: str | list[str] | None = None,
        billing_type: ProductBillingType
        | list[ProductBillingType]
        | None = None,
        customer_id: str | list[str] | None = None,
        metrics: list[str] | None = None,
    ) -> MetricsResponse:
        """
        Get metrics about your orders and subscriptions.

        Currency values are output in cents.

        **Scopes**: `metrics:read`

        Args:
            start_date: Start date.
            end_date: End date.
            timezone: Timezone to use for the timestamps. Default is UTC.
            interval: Interval between two timestamps.
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            billing_type: Filter by billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            customer_id: Filter by customer ID.
            metrics: List of metric slugs to focus on. When provided, only the queries needed for these metrics will be executed, improving performance. If not provided, all metrics are returned.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/",
            path_params={},
            query_params={
                "start_date": start_date,
                "end_date": end_date,
                "timezone": timezone,
                "interval": interval,
                "organization_id": organization_id,
                "product_id": product_id,
                "billing_type": billing_type,
                "customer_id": customer_id,
                "metrics": metrics,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, MetricsResponse, method_errors)

    async def export(
        self,
        *,
        start_date: str,
        end_date: str,
        timezone: Timezone = "UTC",
        interval: TimeInterval,
        organization_id: str | list[str] | None = None,
        product_id: str | list[str] | None = None,
        billing_type: ProductBillingType
        | list[ProductBillingType]
        | None = None,
        customer_id: str | list[str] | None = None,
        metrics: list[str] | None = None,
    ) -> str:
        """
        Export metrics as a CSV file.

        **Scopes**: `metrics:read`

        Args:
            start_date: Start date.
            end_date: End date.
            timezone: Timezone to use for the timestamps. Default is UTC.
            interval: Interval between two timestamps.
            organization_id: Filter by organization ID.
            product_id: Filter by product ID.
            billing_type: Filter by billing type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
            customer_id: Filter by customer ID.
            metrics: List of metric slugs to include in the export. If not provided, all metrics are exported.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/export",
            path_params={},
            query_params={
                "start_date": start_date,
                "end_date": end_date,
                "timezone": timezone,
                "interval": interval,
                "organization_id": organization_id,
                "product_id": product_id,
                "billing_type": billing_type,
                "customer_id": customer_id,
                "metrics": metrics,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_text(response, method_errors)

    async def limits(
        self,
    ) -> MetricsLimits:
        """
        Get the interval limits for the metrics endpoint.

        **Scopes**: `metrics:read`

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/limits",
            path_params={},
            query_params={},
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, MetricsLimits)

    async def list_dashboards(
        self,
        *,
        organization_id: str | list[str] | None = None,
    ) -> list[MetricDashboardSchema]:
        """
        List user-defined metric dashboards.

        **Scopes**: `metrics:read`

        Args:
            organization_id: Filter by organization ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/dashboards",
            path_params={},
            query_params={
                "organization_id": organization_id,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, list[MetricDashboardSchema], method_errors
        )

    async def create_dashboard(
        self,
        **kwargs: typing.Unpack[MetricDashboardCreate],
    ) -> MetricDashboardSchema:
        """
        Create a user-defined metric dashboard.

        **Scopes**: `metrics:write`

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
            url="/v1/metrics/dashboards",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, MetricDashboardSchema, method_errors)

    async def get_dashboard(
        self,
        id: str,
    ) -> MetricDashboardSchema:
        """
        Get a user-defined metric dashboard by ID.

        **Scopes**: `metrics:read`

        Args:
            id: The metric dashboard ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/metrics/dashboards/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, MetricDashboardSchema, method_errors)

    async def delete_dashboard(
        self,
        id: str,
    ) -> None:
        """
        Delete a user-defined metric dashboard.

        **Scopes**: `metrics:write`

        Args:
            id: The metric dashboard ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/metrics/dashboards/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    async def update_dashboard(
        self,
        id: str,
        **kwargs: typing.Unpack[MetricDashboardUpdate],
    ) -> MetricDashboardSchema:
        """
        Update a user-defined metric dashboard.

        **Scopes**: `metrics:write`

        Args:
            id: The metric dashboard ID.
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/metrics/dashboards/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, MetricDashboardSchema, method_errors)
