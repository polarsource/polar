from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import joinedload

from polar.kit.repository import RepositoryBase
from polar.kit.repository.base import Options
from polar.models import Meter, MeterReducer, Reducer


class ReducerRepository(RepositoryBase[Reducer]):
    model = Reducer

    async def get_meter_for_update(self, meter_id: UUID) -> Meter:
        statement = (
            select(Meter)
            .where(Meter.id == meter_id)
            .options(joinedload(Meter.organization))
            .with_for_update(of=Meter)
            .execution_options(populate_existing=True)
        )
        return (await self.session.execute(statement)).scalar_one()

    async def get_by_meter_id(self, meter_id: UUID) -> Reducer | None:
        statement = (
            self.get_base_statement()
            .join(MeterReducer)
            .where(MeterReducer.meter_id == meter_id)
        )
        return await self.get_one_or_none(statement)

    async def get_meters_without_reducers(self, *, limit: int) -> Sequence[Meter]:
        statement = (
            select(Meter)
            .where(
                Meter.deleted_at.is_(None),
                ~select(MeterReducer.meter_id)
                .where(MeterReducer.meter_id == Meter.id)
                .exists(),
            )
            .order_by(Meter.id)
            .limit(limit)
        )
        return (await self.session.scalars(statement)).all()

    async def delete_without_meters(self, *, limit: int) -> int:
        orphaned_ids = (
            select(Reducer.id)
            .where(
                ~select(MeterReducer.reducer_id)
                .join(Meter, Meter.id == MeterReducer.meter_id)
                .where(
                    MeterReducer.reducer_id == Reducer.id,
                    Meter.deleted_at.is_(None),
                )
                .exists()
            )
            .order_by(Reducer.id)
            .limit(limit)
        )
        statement = (
            delete(Reducer).where(Reducer.id.in_(orphaned_ids)).returning(Reducer.id)
        )
        return len((await self.session.scalars(statement)).all())

    async def get_all_active_by_organization(
        self, organization_id: UUID, *, options: Options = ()
    ) -> Sequence[Reducer]:
        """Reducers of the organization used by at least one active meter."""
        active_reducer_ids = (
            select(MeterReducer.reducer_id)
            .join(MeterReducer.meter)
            .where(Meter.archived_at.is_(None), Meter.deleted_at.is_(None))
        )
        statement = (
            self.get_base_statement()
            .where(
                Reducer.organization_id == organization_id,
                Reducer.id.in_(active_reducer_ids),
            )
            .options(*options)
        )
        return await self.get_all(statement)
