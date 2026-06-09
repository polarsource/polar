import asyncio
import logging
from datetime import UTC, datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from polar.config import POLAR_ACCESS_TOKEN, POLL_INTERVAL_SECONDS
from polar.customer_meter import snapshot_from_response
from polar.db import async_session
from polar.meter.event import BufferedEvent
from polar.meter.filter import Filter
from polar.models import CustomerMeter
from polar.repository import CustomerMeterRepository, EventRepository

log = logging.getLogger("polar.sidecar.poll")


async def _has_active_delta(events: EventRepository, meter: CustomerMeter) -> bool:
    """Whether buffered events past the meter's watermark still await upstream balancing.

    Drives convergence: once upstream balances up to our latest matching event, no events
    remain past the watermark and the customer drops out of the poll set until new ones land.
    """
    watermark: int | None = None
    if meter.last_balanced_event_id is not None:
        watermark = await events.get_local_id_for_polar_event(
            meter.last_balanced_event_id
        )
        if watermark is None:
            return False
    delta_events = await events.get_customer_delta_events(
        customer_id=meter.customer_id,
        external_customer_id=meter.external_customer_id,
        watermark_local_id=watermark,
    )
    filter = Filter.model_validate(meter.filter)
    return any(
        filter.matches(BufferedEvent.from_body(event.body)) for event in delta_events
    )


async def _dirty_customers(
    events: EventRepository, cache: CustomerMeterRepository
) -> tuple[set[str], set[str]]:
    """Claim the customers worth polling: those with an unconverged delta on any meter.

    Isolated so the "scan all cached meters" claim can later become a SKIP LOCKED batch
    claim once the buffer moves to Postgres for HA.
    """
    external_ids: set[str] = set()
    customer_ids: set[str] = set()
    for meter in await cache.get_all():
        if await _has_active_delta(events, meter):
            if meter.external_customer_id is not None:
                external_ids.add(meter.external_customer_id)
            else:
                customer_ids.add(meter.customer_id)
    return external_ids, customer_ids


async def _poll_customer(
    client: httpx.AsyncClient,
    session: AsyncSession,
    cache: CustomerMeterRepository,
    params: dict[str, str],
) -> None:
    response = await client.get(
        "/v1/customer-meters/",
        params=params,
        headers={"Authorization": f"Bearer {POLAR_ACCESS_TOKEN}"},
    )
    response.raise_for_status()
    polled_at = datetime.now(UTC)
    for item in response.json()["items"]:
        await cache.upsert(snapshot_from_response(item, polled_at))
    await session.commit()


async def poll_once(client: httpx.AsyncClient) -> None:
    async with async_session() as session:
        events = EventRepository(session)
        cache = CustomerMeterRepository(session)
        external_ids, customer_ids = await _dirty_customers(events, cache)
        for external_id in external_ids:
            await _poll_customer(
                client, session, cache, {"external_customer_id": external_id}
            )
        for customer_id in customer_ids:
            await _poll_customer(client, session, cache, {"customer_id": customer_id})
        polled = len(external_ids) + len(customer_ids)
        if polled:
            log.info("polled %d customer(s)", polled)


async def run_poll_loop(base_url: str) -> None:
    if not POLAR_ACCESS_TOKEN:
        log.warning("POLAR_ACCESS_TOKEN not set; poll loop disabled")
        return
    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        while True:
            try:
                await poll_once(client)
            except Exception:
                log.exception("poll cycle failed; will retry")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
