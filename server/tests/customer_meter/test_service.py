import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
import pytest_asyncio

from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.event.system import SystemEvent
from polar.kit.utils import utc_now
from polar.meter.aggregation import (
    AggregationFunction,
    PropertyAggregation,
)
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import (
    Customer,
    CustomerMeter,
    Event,
    Meter,
    Organization,
)
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_event,
    create_meter,
)


@pytest_asyncio.fixture
async def meter(save_fixture: SaveFixture, organization: Organization) -> Meter:
    return await create_meter(
        save_fixture,
        name="Lite Model Usage",
        filter=Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(property="model", operator=FilterOperator.eq, value="lite")
            ],
        ),
        aggregation=PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        ),
        organization=organization,
    )


@pytest_asyncio.fixture
async def events(
    save_fixture: SaveFixture, customer: Customer, meter: Meter
) -> list[Event]:
    timestamp = utc_now()
    return [
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 10, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 10, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=4),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 0, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=5),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 10, "meter_id": str(meter.id)},
        ),
        # Events that should not be considered by the meter
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=6),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 100, "model": "pro"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=7),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 10, "meter_id": str(uuid.uuid4())},
        ),
    ]


@pytest.mark.asyncio
class TestUpdateCustomerMeter:
    async def test_no_matching_event_not_existing_customer_meter(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> None:
        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, customer, meter
        )

        assert customer_meter is None
        assert updated is False

    async def test_no_matching_event_existing_customer_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            consumed_units=Decimal(0),
            credited_units=20,
            balance=Decimal(20),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(session, customer, meter)

        assert updated_customer_meter is not None
        assert updated_customer_meter == customer_meter
        assert updated_customer_meter.consumed_units == Decimal(0)
        assert updated_customer_meter.credited_units == Decimal(20)
        assert updated_customer_meter.balance == Decimal(20)

        assert updated is False

    async def test_new_customer_meter(
        self,
        session: AsyncSession,
        customer: Customer,
        events: list[Event],
        meter: Meter,
    ) -> None:
        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, customer, meter
        )

        assert customer_meter is not None
        assert customer_meter.customer == customer
        assert customer_meter.meter == meter
        assert customer_meter.consumed_units == Decimal(40)
        assert customer_meter.credited_units == Decimal(10)
        assert customer_meter.balance == Decimal(0)
        assert customer_meter.last_balanced_event == events[-3]

        assert updated is True

    async def test_existing_customer_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        events: list[Event],
        meter: Meter,
    ) -> None:
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            last_balanced_event=events[0],
            consumed_units=Decimal(20),
            credited_units=40,
            balance=Decimal(20),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(session, customer, meter)

        assert updated_customer_meter is not None
        assert customer_meter.consumed_units == Decimal(40)
        assert customer_meter.credited_units == Decimal(50)
        assert customer_meter.balance == Decimal(10)
        assert updated_customer_meter.last_balanced_event == events[-3]

        assert updated is True
