import pytest
from sqlalchemy import select, update

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import Meter, MeterReducer, Organization, Reducer
from polar.reducer.service import reducer as reducer_service
from scripts.backfill_reducers import backfill_batch
from tests.fixtures.database import SaveFixture


@pytest.mark.anyio
class TestBackfillReducers:
    async def test_batch_limits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
    ) -> None:
        second_meter = Meter(
            organization=organization,
            name="Second meter",
            filter=meter.filter,
            aggregation=meter.aggregation,
        )
        await save_fixture(second_meter)

        assert await backfill_batch(session, batch_size=1) == (1, 0)
        assert await backfill_batch(session, batch_size=1) == (1, 0)
        assert await backfill_batch(session, batch_size=1) == (0, 0)

        meter.set_deleted_at()
        second_meter.set_deleted_at()
        assert await backfill_batch(session, batch_size=1) == (0, 1)
        assert await backfill_batch(session, batch_size=1) == (0, 1)
        assert await backfill_batch(session, batch_size=1) == (0, 0)

    async def test_stale_meter_does_not_overwrite_reducer(
        self, session: AsyncSession, meter: Meter
    ) -> None:
        assert await backfill_batch(session) == (1, 0)
        aggregation = PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        )
        await session.execute(
            update(Meter)
            .where(Meter.id == meter.id)
            .values(aggregation=aggregation)
            .execution_options(synchronize_session=False)
        )
        assert meter.aggregation != aggregation

        reducer = await reducer_service.sync_meter(session, meter)
        await session.flush()
        await session.refresh(reducer)
        assert reducer.aggregation == aggregation

    async def test_one_reducer_per_meter_and_rerun(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
    ) -> None:
        archived_meter = Meter(
            organization=organization,
            name="Archived meter with the same definition",
            filter=meter.filter,
            aggregation=meter.aggregation,
            archived_at=utc_now(),
        )
        await save_fixture(archived_meter)

        assert await backfill_batch(session) == (2, 0)
        statement = select(MeterReducer.meter_id, Reducer).join(Reducer)
        first_run = dict((await session.execute(statement)).tuples().all())
        assert set(first_run) == {meter.id, archived_meter.id}
        assert first_run[meter.id].id != first_run[archived_meter.id].id
        for reducer in first_run.values():
            assert reducer.organization_id == organization.id
            assert reducer.filter == meter.filter
            assert reducer.aggregation == meter.aggregation

        assert await backfill_batch(session) == (0, 0)
        second_run = dict((await session.execute(statement)).tuples().all())
        assert {key: reducer.id for key, reducer in second_run.items()} == {
            key: reducer.id for key, reducer in first_run.items()
        }

    @pytest.mark.parametrize("hard_delete", [False, True])
    async def test_deleted_meter_between_runs(
        self, session: AsyncSession, meter: Meter, hard_delete: bool
    ) -> None:
        assert await backfill_batch(session) == (1, 0)
        if hard_delete:
            await session.delete(meter)
        else:
            meter.set_deleted_at()
        await session.flush()

        assert await backfill_batch(session) == (0, 1)
        assert (await session.scalars(select(Reducer))).all() == []
        assert (await session.scalars(select(MeterReducer))).all() == []
        assert await backfill_batch(session) == (0, 0)

    async def test_shared_reducer_kept_for_remaining_meter(
        self,
        session: AsyncSession,
        organization: Organization,
        meter: Meter,
    ) -> None:
        assert await backfill_batch(session) == (1, 0)
        reducer = (await session.scalars(select(Reducer))).one()
        second_meter = Meter(
            organization=organization,
            name="Second meter",
            filter=meter.filter,
            aggregation=meter.aggregation,
        )
        session.add(MeterReducer(meter=second_meter, reducer=reducer))
        meter.set_deleted_at()
        await session.flush()

        assert await backfill_batch(session) == (0, 0)
        assert (await session.scalars(select(Reducer))).one().id == reducer.id
