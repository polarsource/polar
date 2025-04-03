from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from polar.event.repository import EventRepository
from polar.event.system import is_meter_credit_event
from polar.kit.math import non_negative_running_sum
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Customer, CustomerMeter, Event, Meter
from polar.models.event import EventSource
from polar.postgres import AsyncSession

from .repository import CustomerMeterRepository


class CustomerMeterService:
    async def update_customer(self, session: AsyncSession, customer: Customer) -> None:
        repository = MeterRepository.from_session(session)
        statement = repository.get_base_statement().order_by(Meter.created_at.asc())
        async for meter in repository.stream(statement):
            await self.update_customer_meter(session, customer, meter)

    async def update_customer_meter(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> CustomerMeter | None:
        event_repository = EventRepository.from_session(session)
        statement = (
            event_repository.get_base_statement()
            .where(
                Event.customer == customer,
                or_(
                    # Events matching meter definitions
                    event_repository.get_meter_clause(meter),
                    # System events impacting the meter balance
                    event_repository.get_meter_credit_clause(meter),
                ),
            )
            .order_by(Event.ingested_at.asc())
        )

        repository = CustomerMeterRepository.from_session(session)
        customer_meter = await repository.get_by_customer_and_meter(
            customer.id,
            meter.id,
            options=(joinedload(CustomerMeter.last_balanced_event),),
        )
        if (
            customer_meter is not None
            and customer_meter.last_balanced_event is not None
        ):
            statement = statement.where(
                Event.ingested_at > customer_meter.last_balanced_event.ingested_at
            )

        events = await event_repository.get_all(statement)

        if not events:
            return customer_meter

        if customer_meter is None:
            customer_meter = await repository.create(
                CustomerMeter(customer=customer, meter=meter)
            )

        usage_events = [
            event.id for event in events if event.source == EventSource.user
        ]
        usage_units = await meter_service.get_quantity(session, meter, usage_events)

        credit_events = [event for event in events if is_meter_credit_event(event)]
        credited_units = non_negative_running_sum(
            event.user_metadata["units"] for event in credit_events
        )

        # 👟
        new_balance = max(
            Decimal(0),
            customer_meter.units_balance + Decimal(usage_units) - credited_units,
        )

        return await repository.update(
            customer_meter,
            update_dict={
                "units_balance": new_balance,
                "last_balanced_event": events[-1],
            },
        )


customer_meter = CustomerMeterService()
