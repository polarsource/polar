from polar.models import Meter, MeterReducer, Reducer
from polar.postgres import AsyncSession

from .repository import ReducerRepository


class ReducerService:
    async def sync_meter(self, session: AsyncSession, meter: Meter) -> Reducer:
        repository = ReducerRepository.from_session(session)
        meter = await repository.get_meter_for_update(meter.id)
        reducer = await repository.get_by_meter_id(meter.id)
        if reducer is not None:
            return await repository.update(
                reducer,
                update_dict={"filter": meter.filter, "aggregation": meter.aggregation},
            )

        reducer = await repository.create(
            Reducer(
                organization=meter.organization,
                filter=meter.filter,
                aggregation=meter.aggregation,
            )
        )
        session.add(MeterReducer(meter=meter, reducer=reducer))
        return reducer


reducer = ReducerService()
