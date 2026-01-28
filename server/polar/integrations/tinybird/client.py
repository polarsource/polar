import json
from typing import Any
from urllib.parse import urlparse

import clickhouse_connect
import httpx
import structlog

from polar.config import settings
from polar.logging import Logger

from .schemas import TinybirdEvent

log: Logger = structlog.get_logger()

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
    ) -> None:
        if api_token is None:
            api_token = _fetch_local_token(api_url)

        self._api_token = api_token
        self._clickhouse_url = clickhouse_url
        self._clickhouse_client: (
            clickhouse_connect.driver.asyncclient.AsyncClient | None
        ) = None

        self.client = httpx.AsyncClient(
            base_url=api_url,
            headers={"Authorization": f"Bearer {api_token}"} if api_token else {},
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
                port=parsed.port or 7182,
                username="default",
                password=self._api_token or "",
                interface="https" if parsed.scheme == "https" else "http",
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

        response = await self.client.post(
            "/v0/events",
            params={"name": datasource, "wait": str(wait).lower()},
            content=ndjson,
            headers={"Content-Type": "application/x-ndjson"},
        )
        response.raise_for_status()

    async def query(self, sql: str) -> list[dict[str, Any]]:
        ch = await self._get_clickhouse_client()
        result = await ch.query(sql)
        return [dict(zip(result.column_names, row)) for row in result.result_rows]


client = TinybirdClient(
    api_url=settings.TINYBIRD_API_URL,
    clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
    api_token=settings.TINYBIRD_API_TOKEN,
)

__all__ = ["TinybirdEvent", "TinybirdPayloadTooLargeError", "client"]
