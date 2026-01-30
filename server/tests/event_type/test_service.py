from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.event_type.schemas import EventTypeWithStats
from polar.event_type.service import EventTypeService
from polar.event_type.sorting import EventTypesSortProperty
from polar.integrations.tinybird.service import TinybirdEventTypeStats
from polar.kit.pagination import PaginationParams
from polar.models import Organization
from polar.models.event import EventSource
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event, create_event_type


@pytest.mark.asyncio
class TestListWithStatsDualRead:
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_uses_db_when_tinybird_read_disabled_globally(
        self,
        mocker: MockerFixture,
        session: AsyncMock,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        mocker.patch("polar.event_type.service.settings.TINYBIRD_EVENTS_READ", False)

        event_type = await create_event_type(
            save_fixture, organization=organization, name="test.event"
        )
        await create_event(
            save_fixture, organization=organization, event_type=event_type
        )

        service = EventTypeService()
        tinybird_mock = mocker.patch.object(
            service, "_list_with_stats_from_tinybird", new_callable=AsyncMock
        )

        results, count = await service.list_with_stats(
            session,
            auth_subject,
            pagination=PaginationParams(page=1, limit=10),
            sorting=[(EventTypesSortProperty.last_seen, True)],
        )

        tinybird_mock.assert_not_called()
        assert count == 1

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_uses_db_when_org_tinybird_read_disabled(
        self,
        mocker: MockerFixture,
        session: AsyncMock,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        mocker.patch("polar.event_type.service.settings.TINYBIRD_EVENTS_READ", True)
        organization.feature_settings = {"tinybird_read": False}
        await save_fixture(organization)

        event_type = await create_event_type(
            save_fixture, organization=organization, name="test.event"
        )
        await create_event(
            save_fixture, organization=organization, event_type=event_type
        )

        service = EventTypeService()
        tinybird_mock = mocker.patch.object(
            service, "_list_with_stats_from_tinybird", new_callable=AsyncMock
        )

        results, count = await service.list_with_stats(
            session,
            auth_subject,
            pagination=PaginationParams(page=1, limit=10),
            sorting=[(EventTypesSortProperty.last_seen, True)],
        )

        tinybird_mock.assert_not_called()
        assert count == 1

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_returns_tinybird_when_enabled(
        self,
        mocker: MockerFixture,
        session: AsyncMock,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        mocker.patch("polar.event_type.service.settings.TINYBIRD_EVENTS_READ", True)
        organization.feature_settings = {
            "tinybird_read": True,
            "tinybird_compare": False,
        }
        await save_fixture(organization)

        event_type = await create_event_type(
            save_fixture, organization=organization, name="test.event"
        )
        await create_event(
            save_fixture, organization=organization, event_type=event_type
        )

        now = datetime.now(UTC)
        tinybird_results = [
            EventTypeWithStats(
                id=event_type.id,
                created_at=event_type.created_at,
                modified_at=event_type.modified_at,
                name="test.event",
                label="test.event",
                label_property_selector=None,
                organization_id=organization.id,
                source=EventSource.system,
                occurrences=99,
                first_seen=now,
                last_seen=now,
            )
        ]

        service = EventTypeService()
        mocker.patch.object(
            service,
            "_list_with_stats_from_tinybird",
            new_callable=AsyncMock,
            return_value=(tinybird_results, 1),
        )

        results, count = await service.list_with_stats(
            session,
            auth_subject,
            pagination=PaginationParams(page=1, limit=10),
            sorting=[(EventTypesSortProperty.last_seen, True)],
        )

        assert count == 1
        assert results[0].occurrences == 99

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_shadow_mode_runs_both_and_logs(
        self,
        mocker: MockerFixture,
        session: AsyncMock,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        mocker.patch("polar.event_type.service.settings.TINYBIRD_EVENTS_READ", True)
        organization.feature_settings = {
            "tinybird_read": True,
            "tinybird_compare": True,
        }
        await save_fixture(organization)

        event_type = await create_event_type(
            save_fixture, organization=organization, name="test.event"
        )
        await create_event(
            save_fixture, organization=organization, event_type=event_type
        )

        now = datetime.now(UTC)
        tinybird_stats = [
            TinybirdEventTypeStats(
                name="test.event",
                source=EventSource.system,
                occurrences=10,
                first_seen=now,
                last_seen=now,
            )
        ]

        service = EventTypeService()
        logfire_mock = mocker.patch("polar.event_type.service.logfire")

        mocker.patch(
            "polar.integrations.tinybird.service.TinybirdEventTypesQuery.get_event_type_stats",
            new_callable=AsyncMock,
            return_value=tinybird_stats,
        )

        results, count = await service.list_with_stats(
            session,
            auth_subject,
            pagination=PaginationParams(page=1, limit=10),
            sorting=[(EventTypesSortProperty.last_seen, True)],
        )

        assert count == 1
        logfire_mock.span.assert_called_once()
        call_kwargs = logfire_mock.span.call_args.kwargs
        assert call_kwargs["organization_id"] == str(organization.id)
        assert "has_diff" in call_kwargs
