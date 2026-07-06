from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.inputs import (
    WebhookEndpointCreate,
    WebhookEndpointUpdate,
)
from polar.literals import (
    WebhookEventType,
)
from polar.outputs import (
    ListResourceWebhookDelivery,
    ListResourceWebhookEndpoint,
    WebhookDelivery,
    WebhookEndpoint,
)


class WebhooksSync(SyncServiceBase):
    def list_webhook_endpoints(
        self,
        *,
        organization_id: str | list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceWebhookEndpoint:
        """
        List webhook endpoints.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/webhooks/endpoints",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceWebhookEndpoint, method_errors)

    def iter_list_webhook_endpoints(
        self,
        *,
        organization_id: str | list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> typing.Generator[WebhookEndpoint]:
        """
        List webhook endpoints.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type WebhookEndpoint.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_webhook_endpoints(
                organization_id=organization_id,
                page=page,
                limit=limit,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def create_webhook_endpoint(
        self,
        **kwargs: typing.Unpack[WebhookEndpointCreate],
    ) -> WebhookEndpoint:
        """
        Create a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/webhooks/endpoints",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, WebhookEndpoint, method_errors)

    def get_webhook_endpoint(
        self,
        id: str,
    ) -> WebhookEndpoint:
        """
        Get a webhook endpoint by ID.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            id: The webhook endpoint ID.

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/webhooks/endpoints/{id}",
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
        return parse_response_json(response, WebhookEndpoint, method_errors)

    def delete_webhook_endpoint(
        self,
        id: str,
    ) -> None:
        """
        Delete a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/webhooks/endpoints/{id}",
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
        return parse_response_none(response, method_errors)

    def update_webhook_endpoint(
        self,
        id: str,
        **kwargs: typing.Unpack[WebhookEndpointUpdate],
    ) -> WebhookEndpoint:
        """
        Update a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/webhooks/endpoints/{id}",
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
        return parse_response_json(response, WebhookEndpoint, method_errors)

    def reset_webhook_endpoint_secret(
        self,
        id: str,
    ) -> WebhookEndpoint:
        """
        Regenerate a webhook endpoint secret.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/webhooks/endpoints/{id}/secret",
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
        return parse_response_json(response, WebhookEndpoint, method_errors)

    def list_webhook_deliveries(
        self,
        *,
        endpoint_id: str | list[str] | None = None,
        start_timestamp: str | None = None,
        end_timestamp: str | None = None,
        succeeded: bool | None = None,
        query: str | None = None,
        http_code_class: typing.Literal["2xx"]
        | typing.Literal["3xx"]
        | typing.Literal["4xx"]
        | typing.Literal["5xx"]
        | None = None,
        event_type: WebhookEventType | list[WebhookEventType] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceWebhookDelivery:
        """
        List webhook deliveries.

        Deliveries are all the attempts to deliver a webhook event to an endpoint.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            endpoint_id: Filter by webhook endpoint ID.
            start_timestamp: Filter deliveries after this timestamp.
            end_timestamp: Filter deliveries before this timestamp.
            succeeded: Filter by delivery success status.
            query: Query to filter webhook deliveries.
            http_code_class: Filter by HTTP response code class (2xx, 3xx, 4xx, 5xx).
            event_type: Filter by webhook event type.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/webhooks/deliveries",
            path_params={},
            query_params={
                "endpoint_id": endpoint_id,
                "start_timestamp": start_timestamp,
                "end_timestamp": end_timestamp,
                "succeeded": succeeded,
                "query": query,
                "http_code_class": http_code_class,
                "event_type": event_type,
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceWebhookDelivery, method_errors)

    def iter_list_webhook_deliveries(
        self,
        *,
        endpoint_id: str | list[str] | None = None,
        start_timestamp: str | None = None,
        end_timestamp: str | None = None,
        succeeded: bool | None = None,
        query: str | None = None,
        http_code_class: typing.Literal["2xx"]
        | typing.Literal["3xx"]
        | typing.Literal["4xx"]
        | typing.Literal["5xx"]
        | None = None,
        event_type: WebhookEventType | list[WebhookEventType] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> typing.Generator[WebhookDelivery]:
        """
        List webhook deliveries.

        Deliveries are all the attempts to deliver a webhook event to an endpoint.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            endpoint_id: Filter by webhook endpoint ID.
            start_timestamp: Filter deliveries after this timestamp.
            end_timestamp: Filter deliveries before this timestamp.
            succeeded: Filter by delivery success status.
            query: Query to filter webhook deliveries.
            http_code_class: Filter by HTTP response code class (2xx, 3xx, 4xx, 5xx).
            event_type: Filter by webhook event type.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type WebhookDelivery.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_webhook_deliveries(
                endpoint_id=endpoint_id,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
                succeeded=succeeded,
                query=query,
                http_code_class=http_code_class,
                event_type=event_type,
                page=page,
                limit=limit,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def redeliver_webhook_event(
        self,
        id: str,
    ) -> typing.Any:
        """
        Schedule the re-delivery of a webhook event.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook event ID.

        Raises:
            ResourceNotFound: Webhook event not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/webhooks/events/{id}/redeliver",
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
        return parse_response_json(response, typing.Any, method_errors)


class WebhooksAsync(AsyncServiceBase):
    async def list_webhook_endpoints(
        self,
        *,
        organization_id: str | list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceWebhookEndpoint:
        """
        List webhook endpoints.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/webhooks/endpoints",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceWebhookEndpoint, method_errors)

    async def iter_list_webhook_endpoints(
        self,
        *,
        organization_id: str | list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> typing.AsyncGenerator[WebhookEndpoint]:
        """
        List webhook endpoints.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type WebhookEndpoint.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_webhook_endpoints(
                organization_id=organization_id,
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def create_webhook_endpoint(
        self,
        **kwargs: typing.Unpack[WebhookEndpointCreate],
    ) -> WebhookEndpoint:
        """
        Create a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/webhooks/endpoints",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, WebhookEndpoint, method_errors)

    async def get_webhook_endpoint(
        self,
        id: str,
    ) -> WebhookEndpoint:
        """
        Get a webhook endpoint by ID.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            id: The webhook endpoint ID.

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/webhooks/endpoints/{id}",
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
        return parse_response_json(response, WebhookEndpoint, method_errors)

    async def delete_webhook_endpoint(
        self,
        id: str,
    ) -> None:
        """
        Delete a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/webhooks/endpoints/{id}",
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
        return parse_response_none(response, method_errors)

    async def update_webhook_endpoint(
        self,
        id: str,
        **kwargs: typing.Unpack[WebhookEndpointUpdate],
    ) -> WebhookEndpoint:
        """
        Update a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/webhooks/endpoints/{id}",
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
        return parse_response_json(response, WebhookEndpoint, method_errors)

    async def reset_webhook_endpoint_secret(
        self,
        id: str,
    ) -> WebhookEndpoint:
        """
        Regenerate a webhook endpoint secret.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/webhooks/endpoints/{id}/secret",
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
        return parse_response_json(response, WebhookEndpoint, method_errors)

    async def list_webhook_deliveries(
        self,
        *,
        endpoint_id: str | list[str] | None = None,
        start_timestamp: str | None = None,
        end_timestamp: str | None = None,
        succeeded: bool | None = None,
        query: str | None = None,
        http_code_class: typing.Literal["2xx"]
        | typing.Literal["3xx"]
        | typing.Literal["4xx"]
        | typing.Literal["5xx"]
        | None = None,
        event_type: WebhookEventType | list[WebhookEventType] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceWebhookDelivery:
        """
        List webhook deliveries.

        Deliveries are all the attempts to deliver a webhook event to an endpoint.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            endpoint_id: Filter by webhook endpoint ID.
            start_timestamp: Filter deliveries after this timestamp.
            end_timestamp: Filter deliveries before this timestamp.
            succeeded: Filter by delivery success status.
            query: Query to filter webhook deliveries.
            http_code_class: Filter by HTTP response code class (2xx, 3xx, 4xx, 5xx).
            event_type: Filter by webhook event type.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/webhooks/deliveries",
            path_params={},
            query_params={
                "endpoint_id": endpoint_id,
                "start_timestamp": start_timestamp,
                "end_timestamp": end_timestamp,
                "succeeded": succeeded,
                "query": query,
                "http_code_class": http_code_class,
                "event_type": event_type,
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceWebhookDelivery, method_errors)

    async def iter_list_webhook_deliveries(
        self,
        *,
        endpoint_id: str | list[str] | None = None,
        start_timestamp: str | None = None,
        end_timestamp: str | None = None,
        succeeded: bool | None = None,
        query: str | None = None,
        http_code_class: typing.Literal["2xx"]
        | typing.Literal["3xx"]
        | typing.Literal["4xx"]
        | typing.Literal["5xx"]
        | None = None,
        event_type: WebhookEventType | list[WebhookEventType] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> typing.AsyncGenerator[WebhookDelivery]:
        """
        List webhook deliveries.

        Deliveries are all the attempts to deliver a webhook event to an endpoint.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            endpoint_id: Filter by webhook endpoint ID.
            start_timestamp: Filter deliveries after this timestamp.
            end_timestamp: Filter deliveries before this timestamp.
            succeeded: Filter by delivery success status.
            query: Query to filter webhook deliveries.
            http_code_class: Filter by HTTP response code class (2xx, 3xx, 4xx, 5xx).
            event_type: Filter by webhook event type.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type WebhookDelivery.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_webhook_deliveries(
                endpoint_id=endpoint_id,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
                succeeded=succeeded,
                query=query,
                http_code_class=http_code_class,
                event_type=event_type,
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def redeliver_webhook_event(
        self,
        id: str,
    ) -> typing.Any:
        """
        Schedule the re-delivery of a webhook event.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook event ID.

        Raises:
            ResourceNotFound: Webhook event not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/webhooks/events/{id}/redeliver",
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
        return parse_response_json(response, typing.Any, method_errors)
