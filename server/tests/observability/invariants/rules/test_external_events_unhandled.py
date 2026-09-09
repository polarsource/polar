from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.models import ExternalEvent
from polar.models.external_event import ExternalEventSource
from polar.observability.invariants.rules.external_events_unhandled import (
    ExternalEventsUnhandledInvariant,
    ExternalEventsUnhandledInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestCheck:
    @pytest.mark.parametrize("count", [0, 1, 15])
    async def test_unhandled_events(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        count: int,
    ) -> None:
        now = utc_now()
        mocker.patch(
            "polar.observability.invariants.rules.external_events_unhandled.utc_now",
            return_value=now,
        )
        for index, (age, handled_at) in enumerate(
            [
                (timedelta(minutes=10), now),
                (timedelta(minutes=5), None),
                (timedelta(minutes=1), None),
            ]
        ):
            await save_fixture(
                ExternalEvent(
                    source=ExternalEventSource.stripe,
                    task_name="task_name",
                    external_id=f"ignored_{index}",
                    data={},
                    created_at=now - age,
                    handled_at=handled_at,
                )
            )

        events = []
        for index in range(count):
            event = ExternalEvent(
                source=list(ExternalEventSource)[index % len(ExternalEventSource)],
                task_name="task_name",
                external_id=f"unhandled_{index}",
                data={},
                created_at=now - timedelta(minutes=6 + index),
            )
            await save_fixture(event)
            events.append(event)

        invariant = ExternalEventsUnhandledInvariant(session)
        if count == 0:
            await invariant.check()
        else:
            with pytest.raises(ExternalEventsUnhandledInvariantError) as exc_info:
                await invariant.check()
            assert exc_info.value.context == {
                "count": count,
                "external_events": {
                    "ids": [event.id for event in reversed(events)][:10],
                    "has_more": count > 10,
                },
            }
