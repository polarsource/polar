import uuid
from decimal import Decimal

from sqlalchemy import select

from polar.models import Event, Meter
from polar.postgres import AsyncSession


class MeterService:
    async def get_value(
        self,
        session: AsyncSession,
        meter: Meter,
        *,
        customer_id: uuid.UUID | None = None,
        external_customer_id: str | None = None,
    ) -> Decimal:
        statement = select(meter.aggregation.get_sql_column(Event))

        if customer_id is not None:
            statement = statement.where(Event.customer_id == customer_id)

        if external_customer_id is not None:
            statement = statement.where(
                Event.external_customer_id == external_customer_id
            )

        statement = statement.where(
            meter.filter.get_sql_clause(Event),
            # Additional clauses to make sure we work on rows with the right type for aggregation
            meter.aggregation.get_sql_clause(Event),
        )

        result = await session.execute(statement)
        return result.scalar_one() or Decimal(0)


meter = MeterService()
