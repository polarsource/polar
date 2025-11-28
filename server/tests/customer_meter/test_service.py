import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
import pytest_asyncio

from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.event.system import SystemEvent
from polar.kit.utils import utc_now
from polar.locker import Locker
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


def lstr(s: str) -> str:
    """Generate a unique string by appending a random suffix."""
    return f"{s}_{uuid.uuid4().hex[:8]}"


@pytest_asyncio.fixture
async def customer_with_external_id(
    save_fixture: SaveFixture, organization: Organization
) -> Customer:
    """Customer with external_id set - triggers UNION code path."""
    customer = Customer(
        organization=organization,
        email=lstr("customer-external@example.com"),
        external_id=lstr("ext_customer"),
    )
    await save_fixture(customer)
    return customer


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
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(meter.id)},
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
            metadata={"tokens": 10, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=5),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 0, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=6),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 10, "meter_id": str(meter.id)},
        ),
        # Events that should not be considered by the meter
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=7),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 100, "model": "pro"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=8),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 10, "meter_id": str(uuid.uuid4())},
        ),
    ]


@pytest_asyncio.fixture
async def events_for_external_customer(
    save_fixture: SaveFixture, customer_with_external_id: Customer, meter: Meter
) -> list[Event]:
    """Events for a customer with external_id - tests the UNION code path."""
    timestamp = utc_now()
    return [
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer_with_external_id.organization,
            customer=customer_with_external_id,
            metadata={"tokens": 15, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer_with_external_id.organization,
            customer=customer_with_external_id,
            metadata={"tokens": 25, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=customer_with_external_id.organization,
            customer=customer_with_external_id,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 50, "meter_id": str(meter.id)},
        ),
    ]


@pytest.mark.asyncio
class TestUpdateCustomerMeter:
    async def test_no_matching_event_not_existing_customer_meter(
        self, session: AsyncSession, locker: Locker, customer: Customer, meter: Meter
    ) -> None:
        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, locker, customer, meter
        )

        assert customer_meter is None
        assert updated is False

    async def test_no_matching_event_existing_customer_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        customer: Customer,
        meter: Meter,
    ) -> None:
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(
            session, locker, customer, meter
        )

        assert updated_customer_meter is not None
        assert updated_customer_meter == customer_meter
        assert updated_customer_meter.consumed_units == Decimal(0)
        assert updated_customer_meter.credited_units == Decimal(0)
        assert updated_customer_meter.balance == Decimal(0)

        assert updated is False

    async def test_new_customer_meter(
        self,
        session: AsyncSession,
        locker: Locker,
        customer: Customer,
        events: list[Event],
        meter: Meter,
    ) -> None:
        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, locker, customer, meter
        )

        assert customer_meter is not None
        assert customer_meter.customer == customer
        assert customer_meter.meter == meter
        assert customer_meter.consumed_units == Decimal(20)
        assert customer_meter.credited_units == Decimal(10)
        assert customer_meter.balance == Decimal(-10)
        assert customer_meter.last_balanced_event == events[-3]

        assert updated is True

    async def test_existing_customer_meter_new_event(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        customer: Customer,
        events: list[Event],
        meter: Meter,
    ) -> None:
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            last_balanced_event=events[2],
            consumed_units=Decimal(10),
            credited_units=0,
            balance=Decimal(-10),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(
            session, locker, customer, meter
        )

        assert updated_customer_meter is not None
        assert customer_meter.consumed_units == Decimal(20)
        assert customer_meter.credited_units == Decimal(10)
        assert customer_meter.balance == Decimal(-10)
        assert updated_customer_meter.last_balanced_event == events[-3]

        assert updated is True

    async def test_existing_customer_meter_no_new_event(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        customer: Customer,
        events: list[Event],
        meter: Meter,
    ) -> None:
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            last_balanced_event=events[-3],
            consumed_units=Decimal(20),
            credited_units=10,
            balance=Decimal(-10),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(
            session, locker, customer, meter
        )

        assert updated_customer_meter is not None
        assert customer_meter.consumed_units == Decimal(20)
        assert customer_meter.credited_units == Decimal(10)
        assert customer_meter.balance == Decimal(-10)
        assert updated_customer_meter.last_balanced_event == events[-3]

        assert updated is False

    async def test_event_reset_last(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        events = [
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
                source=EventSource.system,
                name=SystemEvent.meter_reset,
                metadata={"meter_id": str(meter.id)},
            ),
        ]
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            last_balanced_event=events[0],
            consumed_units=Decimal(20),
            credited_units=10,
            balance=Decimal(-10),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(
            session, locker, customer, meter
        )

        assert updated_customer_meter is not None
        assert customer_meter.consumed_units == Decimal(0)
        assert customer_meter.credited_units == Decimal(0)
        assert customer_meter.balance == Decimal(0)
        assert updated_customer_meter.last_balanced_event == events[-1]

        assert updated is True

    async def test_customer_with_external_id(
        self,
        session: AsyncSession,
        locker: Locker,
        customer_with_external_id: Customer,
        events_for_external_customer: list[Event],
        meter: Meter,
    ) -> None:
        """
        Test that customers with external_id work correctly.
        """
        # Verify the customer has external_id (this is the key condition)
        assert customer_with_external_id.external_id is not None

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, locker, customer_with_external_id, meter
        )

        assert customer_meter is not None
        assert customer_meter.customer == customer_with_external_id
        assert customer_meter.meter == meter
        # 15 + 25 = 40 tokens consumed
        assert customer_meter.consumed_units == Decimal(40)
        # 50 units credited
        assert customer_meter.credited_units == Decimal(50)
        # balance = credited - consumed = 50 - 40 = 10
        assert customer_meter.balance == Decimal(10)
        assert customer_meter.last_balanced_event == events_for_external_customer[-1]

        assert updated is True
