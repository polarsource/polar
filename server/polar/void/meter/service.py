from collections.abc import Sequence
from uuid import UUID

from polar.exceptions import ResourceNotFound
from polar.models import VoidMeter, VoidReducer
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.organization.service import organization as organization_service
from polar.void.reducer.exceptions import InvalidReducer
from polar.void.reducer.service import reducer as reducer_service

from .repository import MeterRepository
from .schemas import MeterCreate


def validate_reducers(usage: VoidReducer, credit: VoidReducer) -> None:
    if usage.aggregation.func == "derive":
        raise InvalidReducer("Derived reducers are available for metrics only")
    if usage.aggregation.type != "scalar" or credit.aggregation.type != "scalar":
        raise InvalidReducer("Meter reducers must be scalar")
    if credit.aggregation.func != "sum":
        raise InvalidReducer("Credit reducers must be additive")


class MeterService:
    async def list(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> Sequence[VoidMeter]:
        return await MeterRepository.from_session(session).list(organization_id)

    async def get(
        self, session: AsyncReadSession, organization_id: UUID, id: UUID
    ) -> VoidMeter:
        meter = await MeterRepository.from_session(session).get(organization_id, id)
        if meter is None:
            raise ResourceNotFound()
        return meter

    async def create(
        self, session: AsyncSession, organization_id: UUID, create_schema: MeterCreate
    ) -> VoidMeter:
        organization = await organization_service.lock(session, organization_id)
        usage = await reducer_service.get(
            session, organization_id, create_schema.usage_reducer_id
        )
        credit = await reducer_service.get(
            session, organization_id, create_schema.credit_reducer_id
        )
        validate_reducers(usage, credit)
        repository = MeterRepository.from_session(session)
        generation = await repository.next_generation(
            organization_id,
            create_schema.slug,
            create_schema.variant_id,
            create_schema.branch_id,
        )
        meter = VoidMeter(
            **create_schema.model_dump(
                exclude={"usage_reducer_id", "credit_reducer_id"}
            ),
            usage_reducer=usage,
            credit_reducer=credit,
            generation_id=generation,
            organization=organization,
        )
        await repository.create(meter, flush=True)
        return meter


meter = MeterService()
