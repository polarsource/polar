import json
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture
from temporalio.client import Client

from polar.kit.utils import utc_now
from polar.models import Organization, VoidBillingIdentity
from polar.postgres import AsyncSession
from polar.void.event.repository import EventRepository
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import InvalidAttribution, ReservedEventName
from polar.void.event.service import event as event_service
from polar.void.tinybird import TinybirdApi
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestIngest:
    async def test_first_write_wins_and_attributes_tree(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        root = VoidBillingIdentity(organization=organization, external_id="root")
        await save_fixture(root)
        actor = VoidBillingIdentity(
            organization=organization, external_id="actor", parent=root
        )
        await save_fixture(actor)
        timestamp = datetime(2024, 1, 1, tzinfo=UTC)
        original = EventCreate(
            external_id="event",
            name="usage",
            external_identity_id="actor",
            timestamp=timestamp,
            metadata={"value": 2, "nested": [True, None]},
        )
        different = EventCreate(
            external_id="event", name="different", external_identity_id="missing"
        )
        assert await event_service.ingest(
            session, organization.id, [original, different], EventSource.user
        ) == (1, 1)
        repository = EventRepository.from_session(session)
        records = await repository.pending({organization.id}, limit=50)
        assert len(records) == 1
        canonical = dict(records[0].payload)
        assert records[0].timestamp == timestamp
        assert canonical["external_root_id"] == "root"
        assert canonical["external_identity_id"] == "actor"
        assert canonical["source"] == "user"
        assert json.loads(canonical["metadata"]) == original.metadata
        actor.deleted_at = utc_now()
        await save_fixture(actor)
        assert await event_service.ingest(
            session, organization.id, [different], EventSource.user
        ) == (0, 1)
        assert (await repository.pending({organization.id}, limit=50))[
            0
        ].payload == canonical

    @pytest.mark.parametrize("state", ["missing", "other_organization", "deleted_root"])
    async def test_invalid_attribution_is_atomic(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        save_fixture: SaveFixture,
        state: str,
    ) -> None:
        if state != "missing":
            await save_fixture(
                VoidBillingIdentity(
                    organization=organization_second
                    if state == "other_organization"
                    else organization,
                    external_id="actor",
                    deleted_at=utc_now() if state == "deleted_root" else None,
                )
            )
        with pytest.raises(InvalidAttribution):
            await event_service.ingest(
                session,
                organization.id,
                [
                    EventCreate(external_id="valid", name="usage"),
                    EventCreate(
                        external_id="invalid",
                        name="usage",
                        external_identity_id="actor",
                    ),
                ],
                EventSource.user,
            )
        assert (
            await EventRepository.from_session(session).pending(
                {organization.id}, limit=50
            )
            == []
        )

    async def test_external_keys_are_scoped_by_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        item = EventCreate(external_id="same", name="usage")
        for org in (organization, organization_second):
            assert await event_service.ingest(
                session, org.id, [item], EventSource.user
            ) == (1, 0)
        records = await EventRepository.from_session(session).pending(
            {organization.id}, limit=50
        )
        assert len(records) == 1
        assert records[0].payload["organization_id"] == str(organization.id)
        assert records[0].payload["external_root_id"] is None

    async def test_reserved_system_events(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        item = EventCreate(external_id="reserved", name="identity.entitlements.updated")
        with pytest.raises(ReservedEventName):
            await event_service.ingest(
                session, organization.id, [item], EventSource.user
            )
        assert await event_service.ingest(
            session, organization.id, [item], EventSource.system
        ) == (1, 0)


@pytest.mark.asyncio
class TestDelivery:
    @pytest.mark.parametrize("failure", ["tinybird", "notification"])
    async def test_failed_delivery_recovers_without_reingestion(
        self,
        session: AsyncSession,
        organization: Organization,
        mocker: MockerFixture,
        failure: str,
    ) -> None:
        timestamp = utc_now() - timedelta(days=30)
        item = EventCreate(external_id="late", name="usage", timestamp=timestamp)
        await event_service.ingest(session, organization.id, [item], EventSource.user)
        tinybird = MagicMock(spec=TinybirdApi)
        temporal = MagicMock(spec=Client)
        touch = mocker.patch(
            "polar.void.event.service.reducer_service.touch_buckets",
            new_callable=AsyncMock,
        )
        if failure == "tinybird":
            tinybird.ingest_batch.side_effect = RuntimeError("unavailable")
        else:
            touch.side_effect = RuntimeError("unavailable")
        with pytest.raises(RuntimeError, match="unavailable"):
            await event_service.deliver_pending(
                session, tinybird, temporal, {organization.id}
            )
        pending = await EventRepository.from_session(session).pending(
            {organization.id}, limit=50
        )
        assert len(pending) == 1
        canonical = dict(pending[0].payload)
        tinybird.ingest_batch.side_effect = None
        touch.side_effect = None
        assert (
            await event_service.deliver_pending(
                session, tinybird, temporal, {organization.id}
            )
            == 1
        )
        assert tinybird.ingest_batch.call_args.args == ("void_events", [canonical])
        touch.assert_called_with(temporal, organization.id, [timestamp])
        assert (
            await EventRepository.from_session(session).pending(
                {organization.id}, limit=50
            )
            == []
        )
        assert await event_service.ingest(
            session, organization.id, [item], EventSource.user
        ) == (0, 1)
        assert (
            await event_service.deliver_pending(
                session, tinybird, temporal, {organization.id}
            )
            == 0
        )

    async def test_batch_limit_and_allowlist(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        mocker: MockerFixture,
    ) -> None:
        for org in (organization, organization_second):
            await event_service.ingest(
                session,
                org.id,
                [EventCreate(external_id=str(i), name="usage") for i in range(3)],
                EventSource.user,
            )
        tinybird = MagicMock(spec=TinybirdApi)
        temporal = MagicMock(spec=Client)
        mocker.patch(
            "polar.void.event.service.reducer_service.touch_buckets",
            new_callable=AsyncMock,
        )
        assert (
            await event_service.deliver_pending(
                session, tinybird, temporal, {organization.id}, limit=2
            )
            == 2
        )
        assert (
            len(
                await EventRepository.from_session(session).pending(
                    {organization.id}, limit=50
                )
            )
            == 1
        )
        assert (
            len(
                await EventRepository.from_session(session).pending(
                    {organization_second.id}, limit=50
                )
            )
            == 3
        )
        assert (
            await event_service.deliver_pending(session, tinybird, temporal, set()) == 0
        )


@pytest.mark.asyncio
class TestList:
    async def test_filters_and_decodes_event_rows(
        self, organization: Organization
    ) -> None:
        tinybird = MagicMock(spec=TinybirdApi)
        tinybird.query.return_value = {
            "data": [
                {
                    "id": str(organization.id),
                    "timestamp": "2025-01-01 12:00:00.123456",
                    "name": "usage",
                    "source": "user",
                    "external_id": "event",
                    "external_identity_id": "actor",
                    "external_root_id": "root",
                    "metadata": '{"value":2}',
                    "total_count": 12,
                }
            ]
        }
        result = await event_service.list(
            tinybird, organization.id, 5, "actor", "root", "usage"
        )
        assert result.pagination.total_count == 12
        assert result.items[0].timestamp == datetime(
            2025, 1, 1, 12, 0, 0, 123456, tzinfo=UTC
        )
        assert result.items[0].metadata == {"value": 2}
        tinybird.query.assert_called_once_with(
            "void_events_list",
            {
                "organization_id": str(organization.id),
                "limit": 5,
                "external_identity_id": "actor",
                "external_root_id": "root",
                "name": "usage",
            },
        )

    async def test_empty_results(self, organization: Organization) -> None:
        tinybird = MagicMock(spec=TinybirdApi)
        tinybird.query.return_value = {"data": []}
        result = await event_service.list(tinybird, organization.id, 25)
        assert result.items == []
        assert result.pagination.total_count == 0
