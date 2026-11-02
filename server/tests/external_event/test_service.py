from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.external_event.service import ExternalEventAlreadyHandled
from polar.external_event.service import external_event as external_event_service
from polar.kit.utils import utc_now
from polar.models import ExternalEvent
from polar.models.external_event import ExternalEventSource, StripeEvent
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.external_event.service.enqueue_job")


@pytest.mark.anyio
class TestEnqueue:
    async def test_basic(
        self, session: AsyncSession, enqueue_job_mock: AsyncMock
    ) -> None:
        event = await external_event_service.enqueue(
            session, ExternalEventSource.stripe, "task_name", "EXTERNAL_EVENT_ID", {}
        )

        assert event.source == ExternalEventSource.stripe
        assert event.task_name == "task_name"
        assert event.external_id == "EXTERNAL_EVENT_ID"

        enqueue_job_mock.assert_called_once_with("task_name", event.id, delay=None)

    async def test_already_existing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        enqueue_job_mock: AsyncMock,
    ) -> None:
        existing_event = ExternalEvent(
            source=ExternalEventSource.stripe,
            task_name="task_name",
            external_id="EXTERNAL_EVENT_ID",
            data={},
        )
        await save_fixture(existing_event)

        event = await external_event_service.enqueue(
            session, ExternalEventSource.stripe, "task_name", "EXTERNAL_EVENT_ID", {}
        )

        assert event == existing_event

        enqueue_job_mock.assert_not_called()


@pytest.mark.anyio
class TestHandle:
    @pytest.mark.parametrize("allow_replay", [False, True])
    async def test_handled_event_replay_is_explicit(
        self, session: AsyncSession, save_fixture: SaveFixture, allow_replay: bool
    ) -> None:
        handled_at = utc_now()
        event = StripeEvent(
            task_name="test", external_id="evt_handled", data={}, handled_at=handled_at
        )
        await save_fixture(event)

        if allow_replay:
            async with external_event_service.handle_stripe(
                session, event.id, allow_replay=True
            ) as handled_event:
                assert handled_event.id == event.id
        else:
            with pytest.raises(ExternalEventAlreadyHandled):
                async with external_event_service.handle_stripe(session, event.id):
                    pytest.fail("Handled events must not replay by default")

        assert event.handled_at == handled_at
