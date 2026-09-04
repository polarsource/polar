from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.v2026_04.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.v2026_04.inputs import (
    WebhookEndpointCreate,
    WebhookEndpointUpdate,
)
from polar.v2026_04.literals import (
    WebhookEventType,
)
from polar.v2026_04.outputs import (
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceWebhookEndpoint:
        """
        List webhook endpoints.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[WebhookEndpoint, None, None]:
        """
        List webhook endpoints.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            A generator that yields items of type WebhookEndpoint.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_webhook_endpoints(
                organization_id=organization_id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def create_webhook_endpoint(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[WebhookEndpointCreate],
    ) -> WebhookEndpoint:
        """
        Create a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/webhooks/endpoints",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> WebhookEndpoint:
        """
        Get a webhook endpoint by ID.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/webhooks/endpoints/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> None:
        """
        Delete a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/webhooks/endpoints/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[WebhookEndpointUpdate],
    ) -> WebhookEndpoint:
        """
        Update a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/webhooks/endpoints/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> WebhookEndpoint:
        """
        Regenerate a webhook endpoint secret.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/webhooks/endpoints/{id}/secret",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        http_code_class: typing.Literal["2xx", "3xx", "4xx", "5xx"] | None = None,
        event_type: WebhookEventType | list[WebhookEventType] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
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
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        http_code_class: typing.Literal["2xx", "3xx", "4xx", "5xx"] | None = None,
        event_type: WebhookEventType | list[WebhookEventType] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[WebhookDelivery, None, None]:
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
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            A generator that yields items of type WebhookDelivery.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def redeliver_webhook_event(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Any:
        """
        Schedule the re-delivery of a webhook event.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook event ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Webhook event not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/webhooks/events/{id}/redeliver",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceWebhookEndpoint:
        """
        List webhook endpoints.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[WebhookEndpoint, None]:
        """
        List webhook endpoints.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            organization_id: Filter by organization ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            An async generator that yields items of type WebhookEndpoint.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_webhook_endpoints(
                organization_id=organization_id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def create_webhook_endpoint(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[WebhookEndpointCreate],
    ) -> WebhookEndpoint:
        """
        Create a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/webhooks/endpoints",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> WebhookEndpoint:
        """
        Get a webhook endpoint by ID.

        **Scopes**: `webhooks:read` `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/webhooks/endpoints/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> None:
        """
        Delete a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/webhooks/endpoints/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[WebhookEndpointUpdate],
    ) -> WebhookEndpoint:
        """
        Update a webhook endpoint.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/webhooks/endpoints/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> WebhookEndpoint:
        """
        Regenerate a webhook endpoint secret.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook endpoint ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Webhook endpoint not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/webhooks/endpoints/{id}/secret",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        http_code_class: typing.Literal["2xx", "3xx", "4xx", "5xx"] | None = None,
        event_type: WebhookEventType | list[WebhookEventType] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
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
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        http_code_class: typing.Literal["2xx", "3xx", "4xx", "5xx"] | None = None,
        event_type: WebhookEventType | list[WebhookEventType] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[WebhookDelivery, None]:
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
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            An async generator that yields items of type WebhookDelivery.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
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
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def redeliver_webhook_event(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Any:
        """
        Schedule the re-delivery of a webhook event.

        **Scopes**: `webhooks:write`

        Args:
            id: The webhook event ID.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Webhook event not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/webhooks/events/{id}/redeliver",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)
