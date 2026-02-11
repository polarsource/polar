import asyncio
import json
from typing import Any
from urllib.parse import urlparse

import clickhouse_connect
import httpx
import logfire
import structlog
from opentelemetry import trace

from polar.config import settings
from polar.logging import Logger

from .schemas import TinybirdEvent

log: Logger = structlog.get_logger()
tracer = trace.get_tracer("polar.integrations.tinybird")

MAX_PAYLOAD_BYTES = 10 * 1024 * 1024  # 10MB
RETRYABLE_STATUS_CODES = {409, 429}
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = [0.1, 0.25, 0.5]


class TinybirdError(Exception):
    """Base exception for Tinybird errors."""

    pass


class TinybirdPayloadTooLargeError(TinybirdError):
    def __init__(self, size: int, max_size: int) -> None:
        self.size = size
        self.max_size = max_size
        super().__init__(f"Payload size {size} bytes exceeds maximum {max_size} bytes")


class TinybirdRequestError(TinybirdError):
    """Raised when a Tinybird API request fails."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        error_body: dict[str, Any] | str | None = None,
        endpoint: str | None = None,
    ) -> None:
        self.status_code = status_code
        self.error_body = error_body
        self.endpoint = endpoint
        super().__init__(message)

    @classmethod
    def from_response(
        cls, response: httpx.Response, endpoint: str | None = None
    ) -> "TinybirdRequestError":
        try:
            error_body: dict[str, Any] | str = response.json()
            if isinstance(error_body, dict):
                message = error_body.get("error", response.reason_phrase)
            else:
                message = str(error_body)
        except Exception:
            error_body = response.text
            message = response.reason_phrase

        return cls(
            message,
            status_code=response.status_code,
            error_body=error_body,
            endpoint=endpoint,
        )


class TinybirdClient:
    def __init__(
        self,
        *,
        api_url: str,
        clickhouse_url: str,
        api_token: str | None,
        read_token: str | None,
        clickhouse_username: str,
        clickhouse_token: str | None,
    ) -> None:
        self._api_url = api_url
        self._api_token = api_token
        self._read_token = read_token
        self._clickhouse_url = clickhouse_url
        self._clickhouse_username = clickhouse_username
        self._clickhouse_token = clickhouse_token
        self._clickhouse_client: (
            clickhouse_connect.driver.asyncclient.AsyncClient | None
        ) = None

        self._write_client = httpx.AsyncClient(
            base_url=api_url,
            headers={"Authorization": f"Bearer {api_token}"} if api_token else {},
            timeout=httpx.Timeout(15.0, connect=3.0),
            transport=(
                httpx.MockTransport(lambda _: httpx.Response(200))
                if api_token is None
                else None
            ),
        )

        self._read_client = httpx.AsyncClient(
            base_url=api_url,
            headers={"Authorization": f"Bearer {read_token}"} if read_token else {},
            timeout=httpx.Timeout(15.0, connect=3.0),
            transport=(
                httpx.MockTransport(lambda _: httpx.Response(200, json={"data": []}))
                if read_token is None
                else None
            ),
        )

    async def _get_clickhouse_client(
        self,
    ) -> clickhouse_connect.driver.asyncclient.AsyncClient:
        if self._clickhouse_client is None:
            parsed = urlparse(self._clickhouse_url)
            self._clickhouse_client = await clickhouse_connect.get_async_client(
                host=parsed.hostname or "localhost",
                port=parsed.port or (443 if parsed.scheme == "https" else 7182),
                username=self._clickhouse_username,
                password=self._clickhouse_token or "",
                interface="https" if parsed.scheme == "https" else "http",
                connect_timeout=3,
                send_receive_timeout=30,
                query_retries=1,
            )
        return self._clickhouse_client

    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        *,
        endpoint_name: str | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        last_response: httpx.Response | None = None
        for attempt in range(MAX_RETRIES + 1):
            response = await client.request(method, url, **kwargs)
            if response.is_success:
                return response
            if response.status_code not in RETRYABLE_STATUS_CODES:
                return response
            last_response = response
            if attempt < MAX_RETRIES:
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            delay = min(float(retry_after), 1.0)
                        except ValueError:
                            delay = RETRY_BACKOFF_SECONDS[attempt]
                    else:
                        delay = RETRY_BACKOFF_SECONDS[attempt]
                else:
                    delay = RETRY_BACKOFF_SECONDS[attempt]
                log.debug(
                    "tinybird.retry",
                    status_code=response.status_code,
                    attempt=attempt + 1,
                    delay=delay,
                    endpoint=endpoint_name,
                )
                await asyncio.sleep(delay)
        assert last_response is not None
        return last_response

    async def endpoint(
        self,
        endpoint_name: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        with logfire.span(
            "ENDPOINT tinybird {endpoint_name}",
            endpoint_name=endpoint_name,
        ) as span:
            span.set_attribute("db.system", "tinybird")
            span.set_attribute("db.operation", "ENDPOINT")
            response = await self._request_with_retry(
                self._read_client,
                "GET",
                f"/v0/pipes/{endpoint_name}.json",
                endpoint_name=endpoint_name,
                params=params,
            )
            if not response.is_success:
                raise TinybirdRequestError.from_response(
                    response, endpoint=endpoint_name
                )
            result = response.json()
            return result.get("data", [])

    async def ingest(
        self, datasource: str, events: list[TinybirdEvent], *, wait: bool = False
    ) -> None:
        if not events:
            return

        ndjson = "\n".join(json.dumps(e) for e in events)
        payload_size = len(ndjson.encode("utf-8"))

        if payload_size > MAX_PAYLOAD_BYTES:
            raise TinybirdPayloadTooLargeError(payload_size, MAX_PAYLOAD_BYTES)

        log.debug(
            "tinybird.ingest",
            datasource=datasource,
            event_count=len(events),
            payload_bytes=payload_size,
        )

        with logfire.span(
            "INSERT tinybird {datasource}",
            datasource=datasource,
            event_count=len(events),
            payload_bytes=payload_size,
        ) as span:
            span.set_attribute("db.system", "tinybird")
            span.set_attribute("db.operation", "INSERT")
            response = await self._request_with_retry(
                self._write_client,
                "POST",
                "/v0/events",
                endpoint_name=datasource,
                params={"name": datasource, "wait": str(wait).lower()},
                content=ndjson,
                headers={"Content-Type": "application/x-ndjson"},
            )
            if not response.is_success:
                raise TinybirdRequestError.from_response(response, endpoint=datasource)

    async def query(
        self,
        sql: str,
        parameters: dict[str, Any] | None = None,
        *,
        db_statement: str,
    ) -> list[dict[str, Any]]:
        operation = sql.strip().split(None, 1)[0].upper() if sql.strip() else "QUERY"
        with tracer.start_as_current_span(f"{operation} tinybird") as span:
            span.set_attribute("db.system", "clickhouse")
            span.set_attribute("db.statement", db_statement)
            ch = await self._get_clickhouse_client()
            result = await ch.query(sql, parameters=parameters)
            return [dict(zip(result.column_names, row)) for row in result.result_rows]

    async def delete(self, datasource: str, delete_condition: str) -> dict[str, Any]:
        log.debug(
            "tinybird.delete",
            datasource=datasource,
            delete_condition=delete_condition,
        )

        with logfire.span(
            "DELETE tinybird {datasource}",
            datasource=datasource,
            delete_condition=delete_condition,
        ) as span:
            span.set_attribute("db.system", "tinybird")
            span.set_attribute("db.operation", "DELETE")
            response = await self._request_with_retry(
                self._write_client,
                "POST",
                f"/v0/datasources/{datasource}/delete",
                endpoint_name=datasource,
                data={"delete_condition": delete_condition},
            )
            if not response.is_success:
                raise TinybirdRequestError.from_response(response, endpoint=datasource)
            return response.json()

    async def get_job(self, job_id: str) -> dict[str, Any]:
        response = await self._request_with_retry(
            self._write_client,
            "GET",
            f"/v0/jobs/{job_id}",
            endpoint_name="jobs",
        )
        if not response.is_success:
            raise TinybirdRequestError.from_response(response, endpoint="jobs")
        return response.json()


client = TinybirdClient(
    api_url=settings.TINYBIRD_API_URL,
    clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
    api_token=settings.TINYBIRD_API_TOKEN,
    read_token=settings.TINYBIRD_READ_TOKEN,
    clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
    clickhouse_token=settings.TINYBIRD_CLICKHOUSE_TOKEN,
)

__all__ = [
    "TinybirdError",
    "TinybirdEvent",
    "TinybirdPayloadTooLargeError",
    "TinybirdRequestError",
    "client",
]
