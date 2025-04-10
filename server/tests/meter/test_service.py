import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
import pytest_asyncio

from polar.auth.models import AuthSubject
from polar.enums import SubscriptionRecurringInterval
from polar.event.system import SystemEvent
from polar.exceptions import PolarRequestValidationError
from polar.kit.time_queries import TimeInterval
from polar.kit.utils import utc_now
from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
)
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.meter.schemas import MeterCreate, MeterUpdate
from polar.meter.service import meter as meter_service
from polar.models import (
    Customer,
    Event,
    Meter,
    Organization,
    Product,
    Subscription,
)
from polar.models.billing_entry import BillingEntryDirection
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_event,
    create_meter,
    create_product,
)


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_last_billed_event_set(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                name="not_matching",
            ),
            await create_event(
                save_fixture,
                organization=organization,
                name="matching",
            ),
            await create_event(
                save_fixture,
                organization=organization,
                name="not_matching",
            ),
        ]

        meter = await meter_service.create(
            session,
            MeterCreate(
                name="Meter",
                filter=Filter(
                    conjunction=FilterConjunction.and_,
                    clauses=[
                        FilterClause(
                            property="name",
                            operator=FilterOperator.eq,
                            value="matching",
                        ),
                    ],
                ),
                aggregation=CountAggregation(),
            ),
            auth_subject,
        )

        assert meter.last_billed_event == events[1]


@pytest.mark.asyncio
class TestUpdate:
    @pytest.mark.parametrize(
        "meter_update",
        [
            MeterUpdate(  # pyright: ignore
                filter=Filter(
                    conjunction=FilterConjunction.and_,
                    clauses=[
                        FilterClause(
                            property="name",
                            operator=FilterOperator.eq,
                            value="matching",
                        )
                    ],
                )
            ),
            MeterUpdate(  # pyright: ignore
                aggregation=PropertyAggregation(
                    func=AggregationFunction.sum, property="tokens"
                )
            ),
        ],
    )
    async def test_sensitive_update_forbidden(
        self,
        meter_update: MeterUpdate,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        event = await create_event(
            save_fixture,
            organization=organization,
            name="matching",
        )
        meter = await create_meter(
            save_fixture, organization=organization, last_billed_event=event
        )

        with pytest.raises(PolarRequestValidationError):
            await meter_service.update(session, meter, meter_update)

    @pytest.mark.parametrize(
        "meter_update",
        [
            MeterUpdate(  # pyright: ignore
                filter=Filter(
                    conjunction=FilterConjunction.and_,
                    clauses=[
                        FilterClause(
                            property="name",
                            operator=FilterOperator.eq,
                            value="matching",
                        )
                    ],
                )
            ),
            MeterUpdate(  # pyright: ignore
                aggregation=PropertyAggregation(
                    func=AggregationFunction.sum, property="tokens"
                )
            ),
        ],
    )
    async def test_sensitive_update_allowed(
        self,
        meter_update: MeterUpdate,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, last_billed_event=None
        )

        updated_meter = await meter_service.update(session, meter, meter_update)

        if meter_update.filter:
            assert updated_meter.filter == meter_update.filter
        if meter_update.aggregation:
            assert updated_meter.aggregation == meter_update.aggregation

    async def test_insensitive_update(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        event = await create_event(
            save_fixture,
            organization=organization,
            name="matching",
        )
        meter = await create_meter(
            save_fixture, organization=organization, last_billed_event=event
        )

        updated_meter = await meter_service.update(
            session,
            meter,
            MeterUpdate(name="New Name"),  # pyright: ignore
        )
        assert updated_meter.name == "New Name"


@pytest.mark.asyncio
class TestGetQuantities:
    @pytest.mark.parametrize(
        "aggregation",
        [
            CountAggregation(),
            PropertyAggregation(func=AggregationFunction.sum, property="tokens"),
            PropertyAggregation(func=AggregationFunction.max, property="tokens"),
            PropertyAggregation(func=AggregationFunction.min, property="tokens"),
            PropertyAggregation(func=AggregationFunction.avg, property="tokens"),
        ],
    )
    async def test_no_event(
        self,
        aggregation: Aggregation,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        timestamp = utc_now()

        meter = await create_meter(
            save_fixture,
            name="Lite Model Usage",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=aggregation,
            organization=customer.organization,
        )

        result = await meter_service.get_quantities(
            session,
            meter,
            customer_id=[customer.id],
            start_timestamp=timestamp,
            end_timestamp=timestamp,
            interval=TimeInterval.day,
        )

        assert len(result.quantities) == 1
        quantity = result.quantities[0]
        assert quantity.quantity == 0
        assert result.total == 0

    @pytest.mark.parametrize(
        "aggregation,expected_value",
        [
            (CountAggregation(), 4),
            (PropertyAggregation(func=AggregationFunction.sum, property="tokens"), 40),
            (PropertyAggregation(func=AggregationFunction.max, property="tokens"), 20),
            (PropertyAggregation(func=AggregationFunction.min, property="tokens"), 0),
            (PropertyAggregation(func=AggregationFunction.avg, property="tokens"), 10),
        ],
    )
    async def test_basic(
        self,
        aggregation: Aggregation,
        expected_value: Decimal,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        timestamp = utc_now()
        events = [
            await create_event(
                save_fixture,
                timestamp=timestamp,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 20, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 10, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 10, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 0, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 100, "model": "pro"},
            ),
        ]

        meter = await create_meter(
            save_fixture,
            name="Lite Model Usage",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=aggregation,
            organization=customer.organization,
        )

        result = await meter_service.get_quantities(
            session,
            meter,
            customer_id=[customer.id],
            start_timestamp=timestamp,
            end_timestamp=timestamp,
            interval=TimeInterval.day,
        )

        assert len(result.quantities) == 1
        quantity = result.quantities[0]
        assert quantity.quantity == expected_value
        assert result.total == expected_value

    async def test_interval(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        past_timestamp = utc_now() - timedelta(days=1)
        today_timestamp = utc_now()
        future_timestamp = utc_now() + timedelta(days=1)

        past_events = [
            await create_event(
                save_fixture,
                timestamp=past_timestamp,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 10, "model": "lite"},
            )
            for _ in range(10)
        ]

        future_events = [
            await create_event(
                save_fixture,
                timestamp=future_timestamp,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 50, "model": "lite"},
            )
            for _ in range(10)
        ]

        meter = await create_meter(
            save_fixture,
            name="Lite Model Usage",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
            organization=customer.organization,
        )

        result = await meter_service.get_quantities(
            session,
            meter,
            customer_id=[customer.id],
            start_timestamp=past_timestamp,
            end_timestamp=future_timestamp,
            interval=TimeInterval.day,
        )

        assert len(result.quantities) == 3

        [yesterday_quantity, today_quantity, tomorrow_quantity] = result.quantities

        assert yesterday_quantity.timestamp.date() == past_timestamp.date()
        assert yesterday_quantity.quantity == 100

        assert today_quantity.timestamp.date() == today_timestamp.date()
        assert today_quantity.quantity == 0

        assert tomorrow_quantity.timestamp.date() == future_timestamp.date()
        assert tomorrow_quantity.quantity == 500

        assert result.total == 600

    @pytest.mark.parametrize(
        "property",
        [
            pytest.param("model", id="not a numeric property"),
            pytest.param("tokns", id="non existing property"),
        ],
    )
    async def test_invalid_aggregation_property(
        self,
        property: str,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        timestamp = utc_now()
        await create_event(
            save_fixture,
            timestamp=timestamp,
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 10, "model": "lite"},
        )

        meter = await create_meter(
            save_fixture,
            name="Lite Model Usage",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property=property
            ),
            organization=customer.organization,
        )

        result = await meter_service.get_quantities(
            session,
            meter,
            customer_id=[customer.id],
            start_timestamp=timestamp,
            end_timestamp=timestamp,
            interval=TimeInterval.day,
        )

        assert len(result.quantities) == 1
        quantity = result.quantities[0]
        assert quantity.quantity == 0
        assert result.total == 0

    @pytest.mark.parametrize(
        "filter_clause",
        [
            pytest.param(
                FilterClause(property="model", operator=FilterOperator.eq, value=100),
                id="value not matching metadata property type",
            ),
            pytest.param(
                FilterClause(
                    property="tokens", operator=FilterOperator.like, value="lite"
                ),
                id="operator not matching metadata property type",
            ),
            pytest.param(
                FilterClause(property="name", operator=FilterOperator.eq, value=100),
                id="operator not matching property type",
            ),
        ],
    )
    async def test_filter_value_type_casts(
        self,
        filter_clause: FilterClause,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        timestamp = utc_now()
        await create_event(
            save_fixture,
            timestamp=timestamp,
            organization=customer.organization,
            customer=customer,
            metadata={"tokens": 10, "model": "lite"},
        )

        meter = await create_meter(
            save_fixture,
            name="Lite Model Usage",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[filter_clause],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
            organization=customer.organization,
        )

        result = await meter_service.get_quantities(
            session,
            meter,
            customer_id=[customer.id],
            start_timestamp=timestamp,
            end_timestamp=timestamp,
            interval=TimeInterval.day,
        )

        assert len(result.quantities) == 1
        quantity = result.quantities[0]
        assert quantity.quantity == 0
        assert result.total == 0


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


@pytest_asyncio.fixture
async def product_metered_unit(
    save_fixture: SaveFixture, meter: Meter, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None)],
    )


@pytest_asyncio.fixture
async def metered_subscription(
    save_fixture: SaveFixture, customer: Customer, product_metered_unit: Product
) -> Subscription:
    return await create_active_subscription(
        save_fixture, customer=customer, product=product_metered_unit
    )


@pytest.mark.asyncio
class TestCreateBillingEntries:
    async def test_no_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        events: list[Event],
        meter: Meter,
        product_metered_unit: Product,
    ) -> None:
        entries = await meter_service.create_billing_entries(session, meter)

        assert len(entries) == 0
        assert meter.last_billed_event == events[-3]

    async def test_no_last_billed_event(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        events: list[Event],
        meter: Meter,
        product_metered_unit: Product,
        metered_subscription: Subscription,
    ) -> None:
        entries = await meter_service.create_billing_entries(session, meter)

        assert len(entries) == 5
        for entry in entries:
            assert entry.event is not None
            assert entry.start_timestamp == entry.event.timestamp
            assert entry.end_timestamp == entry.event.timestamp
            assert entry.direction == BillingEntryDirection.debit
            assert entry.customer == customer
            assert entry.product_price == product_metered_unit.prices[0]

        assert meter.last_billed_event == events[-3]

    async def test_last_billed_event(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        events: list[Event],
        meter: Meter,
        product_metered_unit: Product,
        metered_subscription: Subscription,
    ) -> None:
        meter.last_billed_event = events[1]
        entries = await meter_service.create_billing_entries(session, meter)

        assert len(entries) == 3
        for entry in entries:
            assert entry.event is not None
            assert entry.start_timestamp == entry.event.timestamp
            assert entry.end_timestamp == entry.event.timestamp
            assert entry.direction == BillingEntryDirection.debit
            assert entry.customer == customer
            assert entry.product_price == product_metered_unit.prices[0]

        assert meter.last_billed_event == events[-3]
