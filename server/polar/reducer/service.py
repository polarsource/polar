from collections.abc import Iterable
from datetime import datetime
from decimal import Decimal
from uuid import UUID

import structlog

from polar.logging import Logger
from polar.meter.aggregation import UniqueAggregation
from polar.models import Customer, Meter, MeterReducer, Reducer
from polar.postgres import AsyncSession
from polar.reducer_bucket.service import reducer_bucket as reducer_bucket_service

from .repository import ReducerRepository

log: Logger = structlog.get_logger()


class ReducerService:
    async def seal(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_ids: Iterable[UUID],
        *,
        start: datetime,
        cutoff: datetime,
    ) -> dict[UUID, Decimal]:
        meter_ids = sorted(meter_ids)
        try:
            async with session.begin_nested():
                repository = ReducerRepository.from_session(session)
                reducers: dict[UUID, Reducer] = {}
                meter_reducers: dict[UUID, UUID] = {}
                for meter_id in meter_ids:
                    reducer = await repository.get_by_meter_id(meter_id)
                    if reducer is not None and not isinstance(
                        reducer.aggregation, UniqueAggregation
                    ):
                        reducers[reducer.id] = reducer
                        meter_reducers[meter_id] = reducer.id
                quantities = await reducer_bucket_service.seal(
                    session,
                    list(reducers.values()),
                    customer,
                    start=start,
                    cutoff=cutoff,
                )
        except Exception:
            log.exception(
                "Failed to seal reducer buckets",
                customer_id=customer.id,
                meter_ids=meter_ids,
                cutoff=cutoff.isoformat(),
            )
            return {}
        return {
            meter_id: quantities[reducer_id]
            for meter_id, reducer_id in meter_reducers.items()
            if reducer_id in quantities
        }

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
