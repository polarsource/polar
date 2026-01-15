import json

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
    def __init__(self, api_url: str, api_token: str | None) -> None:
        self.client = httpx.AsyncClient(
            base_url=api_url,
            headers={"Authorization": f"Bearer {api_token}"} if api_token else {},
            transport=(
                httpx.MockTransport(lambda _: httpx.Response(200))
                if api_token is None
                else None
            ),
        )

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


client = TinybirdClient(settings.TINYBIRD_API_URL, settings.TINYBIRD_API_TOKEN)

__all__ = ["TinybirdEvent", "TinybirdPayloadTooLargeError", "client"]
