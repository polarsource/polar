import asyncio
import logging
from datetime import UTC, datetime

import httpx

from polar.config import (
    FLUSH_BATCH_SIZE,
    FLUSH_INTERVAL_SECONDS,
    POLAR_ACCESS_TOKEN,
)
from polar.db import async_session
from polar.repository import EventRepository

log = logging.getLogger("polar.sidecar.sync")


async def flush_once(client: httpx.AsyncClient) -> None:
    async with async_session() as session:
        repository = EventRepository(session)
        events = await repository.get_unacknowledged(FLUSH_BATCH_SIZE)
        if not events:
            return
        response = await client.post(
            "/v1/events/ingest",
            json={"events": [event.body for event in events]},
            headers={"Authorization": f"Bearer {POLAR_ACCESS_TOKEN}"},
        )
        response.raise_for_status()
        await repository.acknowledge([event.id for event in events], datetime.now(UTC))
        await session.commit()
        log.info("flushed %d events upstream", len(events))


async def run_flush_loop(base_url: str) -> None:
    if not POLAR_ACCESS_TOKEN:
        log.warning("POLAR_ACCESS_TOKEN not set; flush loop disabled")
        return
    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        while True:
            try:
                await flush_once(client)
            except Exception:
                log.exception("flush cycle failed; will retry")
            await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
