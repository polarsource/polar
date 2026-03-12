import pytest_asyncio

from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, _event_to_tinybird
from polar.kit.db.models import Model
from polar.models import Event
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def save_fixture(
    save_fixture: SaveFixture,
    tinybird_client: TinybirdClient,
) -> SaveFixture:
    original = save_fixture

    async def _save_and_ingest(model: Model) -> None:
        await original(model)
        if isinstance(model, Event):
            ancestors: list[str] = []
            if model.parent_id is not None:
                ancestors.append(str(model.parent_id))
                if model.root_id and model.root_id != model.parent_id:
                    ancestors.append(str(model.root_id))
            tinybird_event = _event_to_tinybird(model, ancestors)
            await tinybird_client.ingest(DATASOURCE_EVENTS, [tinybird_event], wait=True)

    return _save_and_ingest
