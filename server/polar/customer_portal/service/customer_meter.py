import uuid
from collections.abc import Sequence

from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import contains_eager

from polar.auth.models import AuthSubject, Customer, Member
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import CustomerMeter, Meter
from polar.redis import Redis

from ..repository.customer_meter import CustomerMeterRepository
from ..sorting.customer_meter import CustomerCustomerMeterSortProperty


class CustomerMeterService:
    async def list(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Customer | Member],
        *,
        meter_id: Sequence[uuid.UUID] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[CustomerCustomerMeterSortProperty]] = (
            (CustomerCustomerMeterSortProperty.modified_at, True),
        ),
    ) -> tuple[Sequence[CustomerMeter], int]:
        repository = CustomerMeterRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .join(CustomerMeter.meter)
            .options(
                contains_eager(CustomerMeter.meter),
                joinedload(CustomerMeter.customer).joinedload(Customer.organization),
            )
        )

        if meter_id is not None:
            statement = statement.where(CustomerMeter.meter_id.in_(meter_id))

        if query is not None:
            statement = statement.where(Meter.name.icontains(query, autoescape=True))

        statement = repository.apply_sorting(statement, sorting)

        results, count = await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )
        await customer_meter_service.apply_reducer_units(session, redis, results)
        return results, count

    async def get(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Customer | Member],
        id: uuid.UUID,
    ) -> CustomerMeter | None:
        repository = CustomerMeterRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(CustomerMeter.id == id)
            .options(
                joinedload(CustomerMeter.meter),
                joinedload(CustomerMeter.customer).joinedload(Customer.organization),
            )
        )
        customer_meter = await repository.get_one_or_none(statement)
        if customer_meter is not None:
            await customer_meter_service.apply_reducer_units(
                session, redis, [customer_meter]
            )
        return customer_meter


customer_meter = CustomerMeterService()
