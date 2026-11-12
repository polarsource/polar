import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from pytest_mock import MockerFixture
from redis import RedisError

from polar.config import settings
from polar.customer_meter.repository import CustomerMeterRepository
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.enums import SubscriptionRecurringInterval
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.utils import generate_uuid, utc_now
from polar.meter.aggregation import (
    AggregationFunction,
    CountAggregation,
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
from polar.redis import Redis
from polar.reducer.service import reducer as reducer_service
from polar.reducer.types import UsageSummary
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_active_subscription,
    create_customer,
    create_event,
    create_meter,
    create_product,
)


def lstr(s: str) -> str:
    """Generate a unique string by appending a random suffix."""
    return f"{s}_{uuid.uuid4().hex[:8]}"


@pytest.fixture
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


@pytest.fixture
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


@pytest.fixture
async def events(
    save_fixture: SaveFixture, customer: Customer, meter: Meter
) -> list[Event]:
    timestamp = utc_now()
    return [
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            ingested_at=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            ingested_at=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(meter.id)},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            ingested_at=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 10, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=4),
            ingested_at=timestamp + timedelta(seconds=4),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 10, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=5),
            ingested_at=timestamp + timedelta(seconds=5),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 0, "model": "lite"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=6),
            ingested_at=timestamp + timedelta(seconds=6),
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
            ingested_at=timestamp + timedelta(seconds=7),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 100, "model": "pro"},
        ),
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=8),
            ingested_at=timestamp + timedelta(seconds=8),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 10, "meter_id": str(uuid.uuid4())},
        ),
    ]


@pytest.fixture
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


@pytest.mark.anyio
class TestUpdateCustomerMeter:
    async def test_no_matching_event_not_existing_customer_meter(
        self, session: AsyncSession, redis: Redis, customer: Customer, meter: Meter
    ) -> None:
        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert customer_meter is not None
        assert customer_meter.activated_at is None
        assert updated is False

    async def test_no_matching_event_existing_customer_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
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
            session, redis, customer, meter
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
        redis: Redis,
        customer: Customer,
        events: list[Event],
        meter: Meter,
    ) -> None:
        before = utc_now()
        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )
        after = utc_now()

        assert customer_meter is not None
        assert customer_meter.customer == customer
        assert customer_meter.meter == meter
        assert customer_meter.activated_at is not None
        assert before <= customer_meter.activated_at <= after
        assert customer_meter.consumed_units == Decimal(20)
        assert customer_meter.credited_units == Decimal(10)
        assert customer_meter.balance == Decimal(-10)
        assert customer_meter.last_balanced_event == events[-3]

        assert updated is True

    async def test_historical_usage_ingested_after_reset_timestamp_is_included(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        meter: Meter,
    ) -> None:
        reset_timestamp = utc_now()
        await create_event(
            save_fixture,
            timestamp=reset_timestamp - timedelta(days=1),
            ingested_at=reset_timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=reset_timestamp,
            ingested_at=reset_timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(meter.id)},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(20)
        assert updated is True

    async def test_existing_customer_meter_new_event(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
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
            activated_at=utc_now(),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
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
        redis: Redis,
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
            session, redis, customer, meter
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
        redis: Redis,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        events = [
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=1),
                ingested_at=timestamp + timedelta(seconds=1),
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 20, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=2),
                ingested_at=timestamp + timedelta(seconds=2),
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
            activated_at=utc_now(),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert updated_customer_meter is not None
        assert customer_meter.consumed_units == Decimal(0)
        assert customer_meter.credited_units == Decimal(0)
        assert customer_meter.balance == Decimal(0)
        assert updated_customer_meter.last_balanced_event == events[-1]

        assert updated is True

    async def test_event_reset_last_ingested_before_timestamp(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        events = [
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=1),
                ingested_at=timestamp + timedelta(seconds=1),
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 20, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=2),
                ingested_at=timestamp + timedelta(seconds=2, microseconds=-1),
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
            activated_at=utc_now(),
        )
        await save_fixture(customer_meter)

        (
            updated_customer_meter,
            updated,
        ) = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
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
        redis: Redis,
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
            session, redis, customer_with_external_id, meter
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

    async def test_credit_for_different_meter_ignored(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        different_meter_id = uuid.uuid4()
        # Usage event
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 30, "model": "lite"},
        )
        # Credit for our meter
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 50, "meter_id": str(meter.id)},
        )
        # Credit for different meter - should be ignored
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 200, "meter_id": str(different_meter_id)},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(30)
        assert customer_meter.credited_units == Decimal(50)
        assert customer_meter.balance == Decimal(20)
        assert updated is True

    async def test_credit_for_different_meter_ignored_match_all_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
    ) -> None:
        match_all_meter = await create_meter(
            save_fixture,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=CountAggregation(),
            organization=customer.organization,
        )
        timestamp = utc_now()
        await create_event(
            save_fixture,
            timestamp=timestamp,
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 50, "meter_id": str(match_all_meter.id)},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 200, "meter_id": str(uuid.uuid4())},
        )

        customer_meter, _ = await customer_meter_service.update_customer_meter(
            session, redis, customer, match_all_meter
        )

        assert customer_meter is not None
        assert customer_meter.credited_units == Decimal(50)

    async def test_multiple_credit_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        # Multiple credit events should sum correctly
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 30, "meter_id": str(meter.id)},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 40, "meter_id": str(meter.id)},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 30, "meter_id": str(meter.id)},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(0)
        assert customer_meter.credited_units == Decimal(100)
        assert customer_meter.balance == Decimal(100)
        assert updated is True

    async def test_non_negative_running_sum_behavior(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        # Credits sequence: [100, -150, 50] should yield 50 (not -100)
        # The running sum goes: 100 -> max(0, 100-150)=0 -> 0+50=50
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 100, "meter_id": str(meter.id)},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": -150, "meter_id": str(meter.id)},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 50, "meter_id": str(meter.id)},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(0)
        assert customer_meter.credited_units == Decimal(50)
        assert customer_meter.balance == Decimal(50)
        assert updated is True

    async def test_zero_token_events_counted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        # Events with tokens=0 should be counted in aggregation (sum is still 0)
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 0, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 0, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 10, "meter_id": str(meter.id)},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(0)
        assert customer_meter.credited_units == Decimal(10)
        assert customer_meter.balance == Decimal(10)
        assert updated is True

    async def test_multiple_meter_resets(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        # First reset
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            ingested_at=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 100, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            ingested_at=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(meter.id)},
        )
        # Second reset
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            ingested_at=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 50, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=4),
            ingested_at=timestamp + timedelta(seconds=4),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(meter.id)},
        )
        # Events after latest reset
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=5),
            ingested_at=timestamp + timedelta(seconds=5),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=6),
            ingested_at=timestamp + timedelta(seconds=6),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 30, "meter_id": str(meter.id)},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert customer_meter is not None
        # Only usage after the latest reset should be counted
        assert customer_meter.consumed_units == Decimal(20)
        assert customer_meter.credited_units == Decimal(30)
        assert customer_meter.balance == Decimal(10)
        assert updated is True

    async def test_unique_aggregation_with_external_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer_with_external_id: Customer,
        organization: Organization,
    ) -> None:
        from polar.meter.aggregation import UniqueAggregation

        meter = await create_meter(
            save_fixture,
            name="Unique Users",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="action", operator=FilterOperator.eq, value="login"
                    )
                ],
            ),
            aggregation=UniqueAggregation(property="user_id"),
            organization=organization,
        )

        timestamp = utc_now()
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=organization,
            customer=customer_with_external_id,
            metadata={"action": "login", "user_id": "user_a"},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=organization,
            customer=customer_with_external_id,
            metadata={"action": "login", "user_id": "user_b"},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=organization,
            external_customer_id=customer_with_external_id.external_id,
            metadata={"action": "login", "user_id": "user_a"},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=4),
            organization=organization,
            external_customer_id=customer_with_external_id.external_id,
            metadata={"action": "login", "user_id": "user_c"},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer_with_external_id, meter
        )

        assert customer_meter is not None
        # Should count 3 unique users: user_a, user_b, user_c
        assert customer_meter.consumed_units == Decimal(3)
        assert updated is True

    async def test_max_aggregation_with_external_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer_with_external_id: Customer,
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            name="Max Score",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="type", operator=FilterOperator.eq, value="score"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="value"
            ),
            organization=organization,
        )

        timestamp = utc_now()
        # Events via customer_id
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=organization,
            customer=customer_with_external_id,
            metadata={"type": "score", "value": 50},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=organization,
            customer=customer_with_external_id,
            metadata={"type": "score", "value": 30},
        )
        # Events via external_customer_id
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=organization,
            external_customer_id=customer_with_external_id.external_id,
            metadata={"type": "score", "value": 80},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=4),
            organization=organization,
            external_customer_id=customer_with_external_id.external_id,
            metadata={"type": "score", "value": 20},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer_with_external_id, meter
        )

        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(80)
        assert updated is True

    async def test_nested_property_aggregation_with_external_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer_with_external_id: Customer,
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            name="Max Tokens",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="type", operator=FilterOperator.eq, value="llm"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="_llm.total_tokens"
            ),
            organization=organization,
        )

        timestamp = utc_now()
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=organization,
            customer=customer_with_external_id,
            metadata={"type": "llm", "_llm": {"total_tokens": 200}},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=organization,
            external_customer_id=customer_with_external_id.external_id,
            metadata={"type": "llm", "_llm": {"total_tokens": 100}},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer_with_external_id, meter
        )

        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(200)
        assert updated is True


@pytest.mark.anyio
class TestGetLateUsage:
    async def test_ingested_after_reset_timestamped_before(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        reset_timestamp = utc_now() - timedelta(hours=1)
        await create_event(
            save_fixture,
            timestamp=reset_timestamp,
            ingested_at=reset_timestamp,
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(meter.id)},
        )
        await create_event(
            save_fixture,
            timestamp=reset_timestamp - timedelta(hours=7),
            ingested_at=reset_timestamp + timedelta(minutes=15),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=reset_timestamp + timedelta(minutes=1),
            ingested_at=reset_timestamp + timedelta(minutes=15),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 5, "model": "lite"},
        )

        assert await customer_meter_service._get_late_usage(
            session, customer, meter
        ) == UsageSummary(
            count=1, total=Decimal(20), minimum=Decimal(20), maximum=Decimal(20)
        )

    async def test_without_reset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await create_event(
            save_fixture,
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        )

        assert await customer_meter_service._get_late_usage(
            session, customer, meter
        ) == UsageSummary(count=0, total=Decimal(0), minimum=None, maximum=None)


@pytest.mark.anyio
class TestGetUsageIngestedBefore:
    async def test_without_reset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        before = utc_now() - timedelta(hours=1)
        await create_event(
            save_fixture,
            timestamp=before + timedelta(minutes=1),
            ingested_at=before - timedelta(days=30),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=before - timedelta(days=1),
            ingested_at=before + timedelta(minutes=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 5, "model": "lite"},
        )

        assert await customer_meter_service._get_usage_ingested_before(
            session, customer, meter, before
        ) == UsageSummary(
            count=1, total=Decimal(20), minimum=Decimal(20), maximum=Decimal(20)
        )

    async def test_since_reset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        before = utc_now() - timedelta(hours=1)
        reset_timestamp = before - timedelta(days=1)
        await create_event(
            save_fixture,
            timestamp=reset_timestamp,
            ingested_at=reset_timestamp,
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(meter.id)},
        )
        await create_event(
            save_fixture,
            ingested_at=reset_timestamp - timedelta(minutes=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        )
        await create_event(
            save_fixture,
            ingested_at=reset_timestamp + timedelta(minutes=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 5, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=reset_timestamp - timedelta(hours=1),
            ingested_at=reset_timestamp + timedelta(minutes=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 7, "model": "lite"},
        )

        assert await customer_meter_service._get_usage_ingested_before(
            session, customer, meter, before
        ) == UsageSummary(
            count=1, total=Decimal(5), minimum=Decimal(5), maximum=Decimal(5)
        )


@pytest.mark.anyio
class TestGetRolloverUnits:
    async def test_excludes_usage_at_or_after_cutoff(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        cutoff = utc_now()
        await create_event(
            save_fixture,
            timestamp=cutoff - timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 100, "meter_id": str(meter.id), "rollover": True},
        )
        await create_event(
            save_fixture,
            timestamp=cutoff - timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 20, "model": "lite"},
        )
        await create_event(
            save_fixture,
            timestamp=cutoff,
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 30, "model": "lite"},
        )

        rollover_units = await customer_meter_service.get_rollover_units(
            session, customer, meter, cutoff=cutoff
        )

        assert rollover_units == 80

    @pytest.mark.parametrize(
        ("credits", "usage_tokens", "expected_rollover"),
        [
            pytest.param([], 0, 0, id="no_events"),
            pytest.param(
                [{"units": 100, "rollover": False}],
                0,
                0,
                id="only_non_rollover_credits",
            ),
            pytest.param(
                [{"units": 100, "rollover": True}],
                0,
                100,
                id="only_rollover_credits_no_usage",
            ),
            pytest.param(
                [{"units": 100, "rollover": True}],
                50,
                50,
                id="rollover_partial_usage",
            ),
            pytest.param(
                [{"units": 100, "rollover": True}],
                100,
                0,
                id="rollover_full_usage",
            ),
            pytest.param(
                [{"units": 100, "rollover": True}],
                150,
                0,
                id="usage_exceeds_credits",
            ),
            pytest.param(
                [{"units": 80, "rollover": False}, {"units": 60, "rollover": True}],
                80,
                60,
                id="mixed_credits_exact_non_rollover_consumption",
            ),
            pytest.param(
                [{"units": 80, "rollover": False}, {"units": 60, "rollover": True}],
                100,
                40,
                id="mixed_credits_partial_rollover_consumption",
            ),
            pytest.param(
                [{"units": 80, "rollover": False}, {"units": 60, "rollover": True}],
                150,
                0,
                id="mixed_credits_usage_exceeds_total",
            ),
        ],
    )
    async def test_rollover_calculation(
        self,
        credits: list[dict[str, int | bool]],
        usage_tokens: int,
        expected_rollover: int,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        # Create usage event if needed
        if usage_tokens > 0:
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=1),
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": usage_tokens, "model": "lite"},
            )

        # Create credit events
        for i, credit in enumerate(credits):
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=i + 2),
                organization=customer.organization,
                customer=customer,
                source=EventSource.system,
                name=SystemEvent.meter_credited,
                metadata={
                    "units": credit["units"],
                    "meter_id": str(meter.id),
                    "rollover": credit["rollover"],
                },
            )

        rollover_units = await customer_meter_service.get_rollover_units(
            session, customer, meter
        )

        assert rollover_units == expected_rollover

    async def test_no_events(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        rollover_units = await customer_meter_service.get_rollover_units(
            session, customer, meter
        )

        assert rollover_units == 0

    async def test_only_usage_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        await create_event(
            save_fixture,
            timestamp=timestamp,
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 50, "model": "lite"},
        )

        rollover_units = await customer_meter_service.get_rollover_units(
            session, customer, meter
        )

        assert rollover_units == 0

    async def test_after_meter_reset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        # Credit before reset - should be ignored
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            ingested_at=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 100, "meter_id": str(meter.id), "rollover": True},
        )
        # Reset event
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            ingested_at=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(meter.id)},
        )
        # Credit after reset - should be counted
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            ingested_at=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 50, "meter_id": str(meter.id), "rollover": True},
        )

        rollover_units = await customer_meter_service.get_rollover_units(
            session, customer, meter
        )

        # Only the 50 rollover credit after reset should be counted
        assert rollover_units == 50

    async def test_credit_for_different_meter_ignored(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        different_meter_id = uuid.uuid4()
        # Credit for our meter
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 50, "meter_id": str(meter.id), "rollover": True},
        )
        # Credit for different meter - should be ignored
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={
                "units": 200,
                "meter_id": str(different_meter_id),
                "rollover": True,
            },
        )

        rollover_units = await customer_meter_service.get_rollover_units(
            session, customer, meter
        )

        # Only the 50 for our meter should be counted
        assert rollover_units == 50

    async def test_non_negative_running_sum_with_negative_credits(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        # Credits sequence: [100, -150, 50] should yield 50 (not -100)
        # The running sum goes: 100 -> max(0, 100-150)=0 -> 0+50=50
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 100, "meter_id": str(meter.id), "rollover": True},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": -150, "meter_id": str(meter.id), "rollover": True},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 50, "meter_id": str(meter.id), "rollover": True},
        )

        rollover_units = await customer_meter_service.get_rollover_units(
            session, customer, meter
        )

        assert rollover_units == 50

    async def test_multiple_rollover_credits(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        timestamp = utc_now()
        # Multiple rollover credits should sum
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=1),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 30, "meter_id": str(meter.id), "rollover": True},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=2),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 40, "meter_id": str(meter.id), "rollover": True},
        )
        await create_event(
            save_fixture,
            timestamp=timestamp + timedelta(seconds=3),
            organization=customer.organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={"units": 30, "meter_id": str(meter.id), "rollover": True},
        )

        rollover_units = await customer_meter_service.get_rollover_units(
            session, customer, meter
        )

        assert rollover_units == 100


@pytest.mark.anyio
class TestUpdateCustomer:
    async def test_archived_meter_excluded(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        events: list[Event],
        meter: Meter,
    ) -> None:
        """Test that archived meters are excluded from update_customer."""
        # Archive the meter
        meter.archived_at = utc_now()
        await save_fixture(meter)

        # Run update_customer - should not create customer_meter for archived meter
        await customer_meter_service.update_customer(session, redis, customer)

        # Check that no customer meter was created
        from polar.customer_meter.repository import CustomerMeterRepository

        repository = CustomerMeterRepository.from_session(session)
        customer_meter = await repository.get_by_customer_and_meter(
            customer.id, meter.id
        )
        assert customer_meter is None

    async def test_non_archived_meter_included(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        events: list[Event],
        meter: Meter,
    ) -> None:
        """Test that non-archived meters are included in update_customer."""
        # Meter is not archived by default
        assert meter.archived_at is None

        # Run update_customer - should create customer_meter
        await customer_meter_service.update_customer(session, redis, customer)

        # Check that customer meter was created
        from polar.customer_meter.repository import CustomerMeterRepository

        repository = CustomerMeterRepository.from_session(session)
        customer_meter = await repository.get_by_customer_and_meter(
            customer.id, meter.id
        )
        assert customer_meter is not None
        assert customer_meter.consumed_units > 0


@pytest.mark.anyio
class TestBulkEventProcessing:
    async def test_process_50k_events(
        self,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        """Test bulk event processing with 50k events."""
        event_repository = EventRepository.from_session(session)

        timestamp = utc_now()
        event_count = 50_000
        tokens_per_event = 10

        events = [
            {
                "id": generate_uuid(),
                "organization_id": organization.id,
                "customer_id": customer.id,
                "timestamp": timestamp + timedelta(microseconds=i),
                "ingested_at": timestamp + timedelta(microseconds=i),
                "source": EventSource.user,
                "name": METER_TEST_EVENT,
                "user_metadata": {"tokens": tokens_per_event, "model": "lite"},
            }
            for i in range(event_count)
        ]

        inserted_ids, duplicates = await event_repository.insert_batch(events)
        assert len(inserted_ids) == event_count
        assert duplicates == 0

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter
        )

        assert customer_meter is not None
        assert updated is True
        assert customer_meter.consumed_units == Decimal(event_count * tokens_per_event)
        assert customer_meter.balance == Decimal(-event_count * tokens_per_event)


@pytest.fixture
async def late_usage(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    redis: Redis,
    organization: Organization,
) -> tuple[Customer, Meter]:
    """A reset 30 minutes ago, 3 tokens timestamped after it, and 5 tokens timestamped
    before it but ingested after it."""
    mocker.patch("polar.reducer.service.enqueue_job")
    meter = await create_meter(
        save_fixture,
        organization=organization,
        aggregation=PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        ),
    )
    await reducer_service.sync_meter(session, meter)
    customer = await create_customer(save_fixture, organization=organization)
    now = utc_now()
    reset_at = now - timedelta(minutes=30)
    await create_event(
        save_fixture,
        organization=organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.meter_reset,
        timestamp=reset_at,
        ingested_at=reset_at,
        metadata={"meter_id": str(meter.id)},
    )
    events = [
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            timestamp=timestamp,
            ingested_at=ingested_at,
            metadata={"tokens": tokens},
        )
        for timestamp, ingested_at, tokens in (
            (now - timedelta(minutes=60), now - timedelta(minutes=60), 2),
            (now - timedelta(minutes=10), now - timedelta(minutes=10), 3),
            (now - timedelta(minutes=40), now, 5),
        )
    ]
    await reducer_service.rollup(session, redis, organization.id, events)
    return customer, meter


@pytest.mark.anyio
class TestUpdateCustomerMeterFromReducer:
    @pytest.fixture(autouse=True)
    def enabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "CUSTOMER_METER_UNITS_FROM_REDUCER", True)

    async def test_counts_usage_timestamped_since_the_reset(
        self,
        session: AsyncSession,
        redis: Redis,
        late_usage: tuple[Customer, Meter],
    ) -> None:
        customer, meter = late_usage

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter, activate_meter=True
        )

        assert updated is True
        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(3)

    async def test_falls_back_to_legacy_when_redis_fails(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        late_usage: tuple[Customer, Meter],
    ) -> None:
        customer, meter = late_usage
        mocker.patch(
            "polar.reducer.redis_store.get_bucket_totals", side_effect=RedisError
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter, activate_meter=True
        )

        assert updated is True
        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(8)

    async def test_falls_back_to_legacy_without_a_reducer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        customer = await create_customer(save_fixture, organization=organization)
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            metadata={"tokens": 4},
        )

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter, activate_meter=True
        )

        assert updated is True
        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(4)


@pytest.mark.anyio
class TestUpdateCustomerOnReducerBilling:
    async def test_reads_usage_from_the_reducer_without_comparing(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        late_usage: tuple[Customer, Meter],
    ) -> None:
        customer, meter = late_usage
        organization = customer.organization
        organization.feature_settings = {"reducer_billing_enabled": True}
        await save_fixture(organization)
        compare = mocker.patch.object(reducer_service, "log_customer_meter_comparison")

        await customer_meter_service.update_customer(session, redis, customer)

        customer_meter = await CustomerMeterRepository.from_session(
            session
        ).get_by_customer_and_meter(customer.id, meter.id)
        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(3)
        compare.assert_not_called()

    async def test_direct_meter_update_reads_usage_from_the_reducer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        late_usage: tuple[Customer, Meter],
    ) -> None:
        customer, meter = late_usage
        organization = customer.organization
        organization.feature_settings = {"reducer_billing_enabled": True}
        await save_fixture(organization)

        customer_meter, updated = await customer_meter_service.update_customer_meter(
            session, redis, customer, meter, activate_meter=True
        )

        assert updated is True
        assert customer_meter is not None
        assert customer_meter.consumed_units == Decimal(3)

    async def test_direct_meter_update_refreshes_the_customers_subscription_meters(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        late_usage: tuple[Customer, Meter],
    ) -> None:
        customer, meter = late_usage
        organization = customer.organization
        organization.feature_settings = {"reducer_billing_enabled": True}
        await save_fixture(organization)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        enqueue_job = mocker.patch("polar.customer_meter.service.enqueue_job")

        await customer_meter_service.update_customer_meter(
            session, redis, customer, meter, activate_meter=True
        )

        enqueue_job.assert_any_call("subscription.update_meters", subscription.id)

    async def test_refreshes_the_customers_subscription_meters_once(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        late_usage: tuple[Customer, Meter],
    ) -> None:
        customer, meter = late_usage
        organization = customer.organization
        organization.feature_settings = {"reducer_billing_enabled": True}
        await save_fixture(organization)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        other_meter = await create_meter(
            save_fixture,
            id=uuid.uuid4(),
            organization=organization,
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        await reducer_service.sync_meter(session, other_meter)
        enqueue_job = mocker.patch("polar.customer_meter.service.enqueue_job")

        await customer_meter_service.update_customer(session, redis, customer)

        repository = CustomerMeterRepository.from_session(session)
        for updated_meter in (meter, other_meter):
            customer_meter = await repository.get_by_customer_and_meter(
                customer.id, updated_meter.id
            )
            assert customer_meter is not None
            assert customer_meter.last_balanced_event_id is not None
        assert [
            call
            for call in enqueue_job.call_args_list
            if call.args[0] == "subscription.update_meters"
        ] == [mocker.call("subscription.update_meters", subscription.id)]
