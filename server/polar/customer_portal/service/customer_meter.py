import builtins
import uuid
from collections.abc import Sequence

from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import contains_eager

from polar.auth.models import AuthSubject
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Customer, CustomerMeter, Meter

from ..repository.customer_meter import CustomerMeterRepository
from ..sorting.customer_meter import CustomerCustomerMeterSortProperty


class CustomerMeterService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        *,
        meter_id: Sequence[uuid.UUID] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: builtins.list[Sorting[CustomerCustomerMeterSortProperty]] = [
            (CustomerCustomerMeterSortProperty.modified_at, True)
        ],
    ) -> tuple[Sequence[CustomerMeter], int]:
        repository = CustomerMeterRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .join(CustomerMeter.meter)
            .options(
                contains_eager(CustomerMeter.meter),
            )
        )

        if meter_id is not None:
            statement = statement.where(CustomerMeter.meter_id.in_(meter_id))

        if query is not None:
            statement = statement.where(Meter.name.ilike(f"%{query}%"))

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        id: uuid.UUID,
    ) -> CustomerMeter | None:
        repository = CustomerMeterRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(CustomerMeter.id == id)
            .options(joinedload(CustomerMeter.meter))
        )
        return await repository.get_one_or_none(statement)


customer_meter = CustomerMeterService()
