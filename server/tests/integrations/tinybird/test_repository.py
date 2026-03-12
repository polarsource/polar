from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture

from polar.event.tinybird_repository import TinybirdEventRepository
from polar.integrations.tinybird.service import TinybirdEventTypeStats
from polar.models.event import EventSource


@pytest.mark.asyncio
class TestTinybirdEventRepository:
    async def test_get_event_type_stats_uses_materialized_view(
        self, mocker: MockerFixture
    ) -> None:
        repository = TinybirdEventRepository()
        organization_id = uuid4()
        now = datetime.now(UTC)
        expected = [
            TinybirdEventTypeStats(
                organization_id=organization_id,
                name="event.created",
                source=EventSource.system,
                occurrences=3,
                first_seen=now,
                last_seen=now,
            )
        ]

        materialized_view_mock = mocker.patch(
            "polar.event.tinybird_repository.TinybirdEventTypesQuery.get_event_type_stats",
            new_callable=AsyncMock,
            return_value=expected,
        )
        raw_table_mock = mocker.patch(
            "polar.event.tinybird_repository.TinybirdEventsQuery.get_event_type_stats",
            new_callable=AsyncMock,
        )

        result = await repository.get_event_type_stats(
            organization_id=organization_id,
            source=EventSource.system,
            sorting=[("last_seen", True)],
        )

        assert result == expected
        materialized_view_mock.assert_awaited_once()
        raw_table_mock.assert_not_awaited()

    async def test_get_event_type_stats_uses_raw_table_when_needed(
        self, mocker: MockerFixture
    ) -> None:
        repository = TinybirdEventRepository()
        organization_id = uuid4()
        now = datetime.now(UTC)
        expected = [
            TinybirdEventTypeStats(
                organization_id=organization_id,
                name="event.created",
                source=EventSource.user,
                occurrences=1,
                first_seen=now,
                last_seen=now,
            )
        ]

        raw_table_mock = mocker.patch(
            "polar.event.tinybird_repository.TinybirdEventsQuery.get_event_type_stats",
            new_callable=AsyncMock,
            return_value=expected,
        )
        materialized_view_mock = mocker.patch(
            "polar.event.tinybird_repository.TinybirdEventTypesQuery.get_event_type_stats",
            new_callable=AsyncMock,
        )

        result = await repository.get_event_type_stats(
            organization_id=organization_id,
            customer_id=[uuid4()],
            sorting=[("occurrences", True)],
        )

        assert result == expected
        raw_table_mock.assert_awaited_once()
        materialized_view_mock.assert_not_awaited()

    async def test_event_exists_checks_for_matching_event(
        self, mocker: MockerFixture
    ) -> None:
        repository = TinybirdEventRepository()
        query_mock = mocker.patch(
            "polar.event.tinybird_repository.TinybirdEventsQuery.get_event_ids_and_count",
            new_callable=AsyncMock,
            return_value=(["event-id"], 1),
        )

        exists = await repository.event_exists(uuid4(), uuid4())

        assert exists is True
        query_mock.assert_awaited_once()
