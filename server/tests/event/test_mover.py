import pytest
from pytest_mock import MockerFixture
from sqlalchemy import text

from polar.event.mover import _report_backlog
from polar.event.repository import EventRepository
from polar.observability import STAGED_EVENTS_BACKLOG
from polar.postgres import AsyncSession


@pytest.mark.anyio
class TestReportBacklog:
    async def test_failed_query_keeps_session_usable(
        self, mocker: MockerFixture, session: AsyncSession
    ) -> None:
        async def failing_query(self: EventRepository) -> None:
            await self.session.execute(text("SELECT 1 / 0"))

        mocker.patch.object(EventRepository, "get_staged_events_backlog", failing_query)
        set_mock = mocker.patch.object(STAGED_EVENTS_BACKLOG, "set")

        await _report_backlog(session)

        set_mock.assert_not_called()
        assert await session.scalar(text("SELECT 1")) == 1
