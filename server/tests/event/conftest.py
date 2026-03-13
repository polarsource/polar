from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

import pytest_asyncio

from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.schemas import TinybirdEvent
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, _event_to_tinybird
from polar.kit.db.models import Model
from polar.models import Event
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture, save_fixture_factory


@dataclass
class TinybirdEventBuffer:
    events: list[TinybirdEvent] = field(default_factory=list)


@pytest_asyncio.fixture
async def tinybird_event_buffer() -> TinybirdEventBuffer:
    return TinybirdEventBuffer()


@pytest_asyncio.fixture
async def buffered_save_fixture(
    session: AsyncSession,
    tinybird_event_buffer: TinybirdEventBuffer,
) -> SaveFixture:
    original = save_fixture_factory(session)

    async def _save_and_buffer(model: Model) -> None:
        await original(model)
        if isinstance(model, Event):
            ancestors: list[str] = []
            if model.parent_id is not None:
                ancestors.append(str(model.parent_id))
                if model.root_id and model.root_id != model.parent_id:
                    ancestors.append(str(model.root_id))
            tinybird_event_buffer.events.append(_event_to_tinybird(model, ancestors))

    return _save_and_buffer


@pytest_asyncio.fixture
async def flush_tinybird_events(
    tinybird_client: TinybirdClient,
    tinybird_event_buffer: TinybirdEventBuffer,
) -> Callable[[], Awaitable[None]]:
    async def _flush() -> None:
        if not tinybird_event_buffer.events:
            return

        await tinybird_client.ingest(
            DATASOURCE_EVENTS,
            tinybird_event_buffer.events,
            wait=True,
        )
        tinybird_event_buffer.events.clear()

    return _flush
