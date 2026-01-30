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


class TinybirdPayloadTooLargeError(Exception):
    def __init__(self, size: int, max_size: int) -> None:
        self.size = size
        self.max_size = max_size
        super().__init__(f"Payload size {size} bytes exceeds maximum {max_size} bytes")


class TinybirdClient:
    def __init__(
        self,
        *,
        api_url: str,
        clickhouse_url: str,
        api_token: str | None,
        clickhouse_username: str,
        clickhouse_token: str | None,
    ) -> None:
        self._api_url = api_url
        self._api_token = api_token
        self._clickhouse_url = clickhouse_url
        self._clickhouse_username = clickhouse_username
        self._clickhouse_token = clickhouse_token
        self._clickhouse_client: (
            clickhouse_connect.driver.asyncclient.AsyncClient | None
        ) = None

        self.client = httpx.AsyncClient(
            base_url=api_url,
            headers={"Authorization": f"Bearer {api_token}"} if api_token else {},
            timeout=httpx.Timeout(5.0, connect=3.0),
            transport=(
                httpx.MockTransport(lambda _: httpx.Response(200))
                if api_token is None
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
            response = await self.client.post(
                "/v0/events",
                params={"name": datasource, "wait": str(wait).lower()},
                content=ndjson,
                headers={"Content-Type": "application/x-ndjson"},
            )
            response.raise_for_status()

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


client = TinybirdClient(
    api_url=settings.TINYBIRD_API_URL,
    clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
    api_token=settings.TINYBIRD_API_TOKEN,
    clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
    clickhouse_token=settings.TINYBIRD_CLICKHOUSE_TOKEN,
)

__all__ = ["TinybirdEvent", "TinybirdPayloadTooLargeError", "client"]
