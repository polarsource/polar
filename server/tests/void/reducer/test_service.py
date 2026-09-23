from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncConnection
from temporalio.exceptions import ApplicationError

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Event as EventModel
from polar.models import Organization, VoidReducerBucket, VoidReducerJob
from polar.postgres import AsyncSession
from polar.void.reducer.activities import ReducerActivities
from polar.void.reducer.exceptions import InvalidReducer
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import SlugTaken
from polar.void.reducer.service import reducer as reducer_service
from polar.void.reducer.workflows import RecomputeBucketInput
from tests.fixtures.database import SaveFixture

START = datetime(2026, 1, 1, tzinfo=UTC)


def event_definition(slug: str = "opened") -> ReducerCreate:
    return ReducerCreate.model_validate(
        {
            "slug": slug,
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "count"},
        }
    )


def derived_definition() -> ReducerCreate:
    return ReducerCreate.model_validate(
        {
            "slug": "conversion",
            "aggregation": {
                "func": "derive",
                "inputs": {"opened": "opened", "sold": "sold"},
                "expression": "$sold / $opened * 100",
            },
        }
    )


def result(value: float, receipt: str = "e1") -> dict[str, object]:
    return {
        "data": [
            {
                "external_identity_id": "alice",
                "external_root_id": "customer",
                "bucket_start": START.isoformat(),
                "value": value,
                "data": "",
                "last_processed_event": f'["{receipt}","2026-01-01 00:00:00","2026-01-01 00:00:01",["{receipt}"]]',
            }
        ]
    }


@pytest.mark.asyncio
class TestCreation:
    async def test_event_backfill_is_durable_and_scoped(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        for index, (org, timestamp) in enumerate(
            (
                (organization, START),
                (organization, START + timedelta(seconds=30)),
                (organization, START - timedelta(days=3)),
                (organization_second, START + timedelta(days=2)),
            )
        ):
            await save_fixture(
                EventModel(
                    organization=org,
                    external_id=str(index),
                    timestamp=timestamp,
                    name="usage",
                    user_metadata={},
                )
            )
        source = await reducer_service.create(
            session, organization.id, event_definition()
        )
        jobs = (
            await session.scalars(
                select(VoidReducerJob).where(VoidReducerJob.reducer_id == source.id)
            )
        ).all()
        assert {job.bucket_start for job in jobs} == {START, START - timedelta(days=3)}
        assert all(job.organization_id == organization.id for job in jobs)
        assert await reducer_service.list(session, organization_second.id) == []
        with pytest.raises(ResourceNotFound):
            await reducer_service.get(session, organization_second.id, source.id)
        with pytest.raises(SlugTaken):
            await reducer_service.create(session, organization.id, event_definition())
        assert (
            await reducer_service.get(session, organization.id, source.id)
        ).id == source.id

    async def test_invalid_derived_sources(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await reducer_service.create(
            session, organization_second.id, event_definition()
        )
        with pytest.raises(InvalidReducer):
            await reducer_service.create(session, organization.id, derived_definition())


@pytest.mark.asyncio
class TestRecompute:
    async def test_receipts_retries_derived_backfill_and_late_either_input(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        opened = await reducer_service.create(
            session, organization.id, event_definition()
        )
        sold = await reducer_service.create(
            session, organization.id, event_definition("sold")
        )
        tinybird = Mock()
        tinybird.query.return_value = result(10)
        await reducer_service.recompute_bucket(
            session, tinybird, opened.id, START, organization.id
        )
        derived = await reducer_service.create(
            session, organization.id, derived_definition()
        )
        assert await session.get(VoidReducerJob, (derived.id, START)) is not None
        await reducer_service.recompute_derived(session, derived, START)
        bucket = await session.scalar(
            select(VoidReducerBucket).where(VoidReducerBucket.reducer_id == derived.id)
        )
        assert bucket is not None
        assert bucket.value == 0
        tinybird.query.return_value = result(5, "sold")
        await reducer_service.recompute_bucket(
            session, tinybird, sold.id, START, organization.id
        )
        await reducer_service.recompute_derived(session, derived, START)
        await session.refresh(bucket)
        assert bucket.value == 50
        tinybird.query.return_value = result(20, "late-opened")
        for _ in range(2):
            await reducer_service.recompute_bucket(
                session, tinybird, opened.id, START, organization.id
            )
            await reducer_service.recompute_derived(session, derived, START)
        await session.refresh(bucket)
        assert bucket.value == 25
        assert bucket.data == {"inputs": {"opened": 20, "sold": 5}}
        assert bucket.external_root_id == "customer"
        rows = (
            await session.scalars(
                select(VoidReducerBucket).where(
                    VoidReducerBucket.reducer_id == opened.id
                )
            )
        ).all()
        assert len(rows) == 1
        assert rows[0].last_processed_event == {
            "external_id": "late-opened",
            "timestamp": START.isoformat(),
            "ingested_at": (START + timedelta(seconds=1)).isoformat(),
            "event_ids": ["late-opened"],
        }
        assert tinybird.query.call_args.args[0] == "void_reducer_buckets"
        assert tinybird.query.call_args.args[1]["organization_id"] == str(
            organization.id
        )

    async def test_worker_lookup_is_org_scoped(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        source = await reducer_service.create(
            session, organization.id, event_definition()
        )
        tinybird = Mock()
        with pytest.raises(ResourceNotFound):
            await reducer_service.recompute_bucket(
                session, tinybird, source.id, START, organization_second.id
            )
        tinybird.query.assert_not_called()

    async def test_source_write_and_outbox_rollback_together(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        opened = await reducer_service.create(
            session, organization.id, event_definition()
        )
        await reducer_service.create(session, organization.id, event_definition("sold"))
        derived = await reducer_service.create(
            session, organization.id, derived_definition()
        )
        tinybird = Mock()
        tinybird.query.return_value = result(10)
        savepoint = await session.begin_nested()
        await reducer_service.recompute_bucket(session, tinybird, opened.id, START)
        await savepoint.rollback()
        assert await session.get(VoidReducerJob, (derived.id, START)) is None
        assert (
            await session.scalar(
                select(VoidReducerBucket).where(
                    VoidReducerBucket.reducer_id == opened.id
                )
            )
            is None
        )


@pytest.mark.asyncio
@pytest.mark.usefixtures("enable_void")
class TestDispatch:
    async def test_uncertain_delivery_preserves_job_for_retry(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        opened = await reducer_service.create(
            session, organization.id, event_definition()
        )
        await reducer_service.create(session, organization.id, event_definition("sold"))
        derived = await reducer_service.create(
            session, organization.id, derived_definition()
        )
        await reducer_service.enqueue_dependents(session, opened.id, START)
        assert isinstance(session.bind, AsyncConnection)
        maker = create_async_sessionmaker(session.bind.engine)
        maker.configure(bind=session.bind, join_transaction_mode="create_savepoint")
        temporal = Mock()
        temporal.start_workflow = AsyncMock(
            side_effect=RuntimeError("delivery uncertain")
        )
        activities = ReducerActivities(maker, Mock(), temporal)
        with pytest.raises(RuntimeError, match="uncertain"):
            await activities.dispatch_derived()
        assert await session.get(VoidReducerJob, (derived.id, START)) is not None
        temporal.start_workflow.side_effect = None
        assert await activities.dispatch_derived() == 1
        assert temporal.start_workflow.await_count == 2
        assert await activities.dispatch_derived() == 0
        assert temporal.start_workflow.call_args.kwargs["id"].startswith("polar-void-")
        assert temporal.start_workflow.call_args.args[1].organization_id == str(
            organization.id
        )


@pytest.mark.asyncio
class TestRecords:
    @pytest.mark.parametrize(("func", "expected"), [("first", 1), ("last", 2)])
    async def test_actor_record_order(
        self,
        session: AsyncSession,
        organization: Organization,
        func: str,
        expected: int,
    ) -> None:
        source = await reducer_service.create(
            session,
            organization.id,
            ReducerCreate.model_validate(
                {
                    "slug": func,
                    "filter": {"conjunction": "and", "clauses": []},
                    "aggregation": {"func": func},
                }
            ),
        )
        await reducer_service.write_buckets(
            session,
            [
                {
                    "reducer_id": source.id,
                    "organization_id": organization.id,
                    "external_identity_id": actor,
                    "external_root_id": "root",
                    "bucket_start": START + timedelta(minutes=5 * value),
                    "value": None,
                    "data": {"value": value},
                    "last_processed_event": None,
                }
                for actor in ("alice", "bob")
                for value in (1, 2)
            ],
        )
        rows = await reducer_service.records(
            session, organization.id, source.id, "alice"
        )
        assert len(rows) == 1
        assert rows[0].external_identity_id == "alice"
        assert rows[0].data == {"value": expected}


@pytest.mark.asyncio
class TestWorkerGates:
    async def test_inactive_organization_does_no_work(
        self,
        organization: Organization,
        monkeypatch: pytest.MonkeyPatch,
        session: AsyncSession,
    ) -> None:
        organization.feature_settings = {
            **organization.feature_settings,
            "void_enabled": False,
        }
        await session.flush()
        context = AsyncMock()
        context.__aenter__.return_value = session
        maker = Mock(return_value=context)
        activities = ReducerActivities(maker, Mock(), Mock())
        with pytest.raises(ApplicationError) as listed:
            await activities.list_reducers(str(organization.id))
        assert not listed.value.non_retryable
        with pytest.raises(ApplicationError) as recomputed:
            await activities.recompute_bucket(
                RecomputeBucketInput(
                    str(organization.id), str(organization.id), START.isoformat()
                )
            )
        assert not recomputed.value.non_retryable
        assert await activities.dispatch_derived() == 0
