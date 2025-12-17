import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

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
from polar.models.customer_seat import SeatStatus
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_active_subscription,
    create_customer,
    create_customer_seat,
    create_event,
    create_meter,
    create_organization,
    create_product,
    create_subscription_with_seats,
)


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.meter.service.enqueue_job")


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
        ("aggregation", "expected_value"),
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

    async def test_metadata_filter(
        self,
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
                        property="name",
                        operator=FilterOperator.eq,
                        value=METER_TEST_EVENT,
                    )
                ],
            ),
            aggregation=CountAggregation(),
            organization=customer.organization,
        )

        result = await meter_service.get_quantities(
            session,
            meter,
            customer_id=[customer.id],
            start_timestamp=timestamp,
            end_timestamp=timestamp,
            interval=TimeInterval.day,
            metadata={"model": ["lite"]},
        )

        assert len(result.quantities) == 1
        quantity = result.quantities[0]
        assert quantity.quantity == 4
        assert result.total == 4

    @pytest.mark.parametrize(
        ("customer_aggregation_function", "expected_value"),
        [
            (AggregationFunction.cnt, 2),
            (AggregationFunction.sum, 30),
            (AggregationFunction.max, 20),
            (AggregationFunction.min, 10),
            (AggregationFunction.avg, 15),
            (AggregationFunction.unique, 2),
        ],
    )
    async def test_per_customer_aggregation(
        self,
        customer_aggregation_function: AggregationFunction,
        expected_value: Decimal,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        customer_second: Customer,
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
                customer=customer_second,
                metadata={"tokens": 10, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp,
                organization=customer.organization,
                customer=customer_second,
                metadata={"tokens": 0, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp,
                organization=customer.organization,
                customer=customer_second,
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
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="tokens"
            ),
            organization=customer.organization,
        )

        result = await meter_service.get_quantities(
            session,
            meter,
            start_timestamp=timestamp,
            end_timestamp=timestamp,
            interval=TimeInterval.day,
            customer_aggregation_function=customer_aggregation_function,
        )

        assert len(result.quantities) == 1
        quantity = result.quantities[0]
        assert quantity.quantity == expected_value
        assert result.total == expected_value


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
        enqueue_job_mock: AsyncMock,
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

        enqueue_job_mock.assert_not_called()

    async def test_no_last_billed_event(
        self,
        enqueue_job_mock: AsyncMock,
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
            assert entry.subscription == metered_subscription
            assert entry.product_price == product_metered_unit.prices[0]

        assert meter.last_billed_event == events[-3]

        enqueue_job_mock.assert_called_once_with(
            "subscription.update_meters", metered_subscription.id
        )

    async def test_last_billed_event(
        self,
        enqueue_job_mock: AsyncMock,
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
            assert entry.subscription == metered_subscription
            assert entry.product_price == product_metered_unit.prices[0]

        assert meter.last_billed_event == events[-3]

        enqueue_job_mock.assert_called_once_with(
            "subscription.update_meters", metered_subscription.id
        )


@pytest.mark.asyncio
class TestCreateBillingEntriesWithSeats:
    async def test_seat_holder_overage_charges_billing_manager(
        self,
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        seat_org = await create_organization(
            save_fixture, feature_settings={"seat_based_pricing_enabled": True}
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
                func=AggregationFunction.sum, property="tokens"
            ),
            organization=seat_org,
        )

        billing_manager = await create_customer(save_fixture, organization=seat_org)

        seat_product = await create_product(
            save_fixture,
            organization=seat_org,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None), ("seat", 1000)],
        )

        billing_manager_subscription = await create_subscription_with_seats(
            save_fixture,
            product=seat_product,
            customer=billing_manager,
            seats=5,
        )
        await session.refresh(
            billing_manager_subscription, ["subscription_product_prices"]
        )

        seat_holder = await create_customer(
            save_fixture,
            organization=seat_org,
            email="seat_holder@example.com",
        )

        seat = await create_customer_seat(
            save_fixture,
            subscription=billing_manager_subscription,
            customer=seat_holder,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        await session.refresh(seat, ["subscription", "customer"])
        assert seat.subscription is not None
        await session.refresh(
            seat.subscription, ["product", "customer", "subscription_product_prices"]
        )
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        timestamp = utc_now()
        events = [
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=1),
                organization=seat_org,
                customer=seat_holder,
                metadata={"tokens": 20, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=2),
                organization=seat_org,
                customer=seat_holder,
                metadata={"tokens": 10, "model": "lite"},
            ),
        ]

        entries = await meter_service.create_billing_entries(session, meter)

        assert len(entries) == 2
        for entry in entries:
            assert entry.event is not None
            assert entry.customer == billing_manager
            assert entry.subscription == billing_manager_subscription
            assert entry.product_price == seat_product.prices[0]
            assert entry.direction == BillingEntryDirection.debit

        enqueue_job_mock.assert_called_once_with(
            "subscription.update_meters", billing_manager_subscription.id
        )

    async def test_seat_holder_without_metered_pricing(
        self,
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        seat_org = await create_organization(
            save_fixture, feature_settings={"seat_based_pricing_enabled": True}
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
                func=AggregationFunction.sum, property="tokens"
            ),
            organization=seat_org,
        )

        billing_manager = await create_customer(save_fixture, organization=seat_org)

        non_metered_product = await create_product(
            save_fixture,
            organization=seat_org,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )

        billing_manager_subscription = await create_subscription_with_seats(
            save_fixture,
            product=non_metered_product,
            customer=billing_manager,
            seats=5,
        )

        seat_holder = await create_customer(
            save_fixture,
            organization=seat_org,
            email="seat_holder@example.com",
        )

        seat = await create_customer_seat(
            save_fixture,
            subscription=billing_manager_subscription,
            customer=seat_holder,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        await session.refresh(seat, ["subscription", "customer"])
        assert seat.subscription is not None
        await session.refresh(
            seat.subscription, ["product", "customer", "subscription_product_prices"]
        )
        assert seat.subscription is not None
        await session.refresh(seat.subscription.product, ["organization"])

        timestamp = utc_now()
        events = [
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=1),
                organization=seat_org,
                customer=seat_holder,
                metadata={"tokens": 20, "model": "lite"},
            ),
        ]

        entries = await meter_service.create_billing_entries(session, meter)

        assert len(entries) == 0
        enqueue_job_mock.assert_not_called()

    async def test_multiple_seat_holders_same_subscription(
        self,
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        seat_org = await create_organization(
            save_fixture, feature_settings={"seat_based_pricing_enabled": True}
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
                func=AggregationFunction.sum, property="tokens"
            ),
            organization=seat_org,
        )

        billing_manager = await create_customer(save_fixture, organization=seat_org)

        seat_product = await create_product(
            save_fixture,
            organization=seat_org,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None), ("seat", 1000)],
        )

        billing_manager_subscription = await create_subscription_with_seats(
            save_fixture,
            product=seat_product,
            customer=billing_manager,
            seats=5,
        )
        await session.refresh(
            billing_manager_subscription, ["subscription_product_prices"]
        )

        seat_holder_1 = await create_customer(
            save_fixture,
            organization=seat_org,
            email="seat_holder_1@example.com",
        )

        seat_holder_2 = await create_customer(
            save_fixture,
            organization=seat_org,
            email="seat_holder_2@example.com",
        )

        seat1 = await create_customer_seat(
            save_fixture,
            subscription=billing_manager_subscription,
            customer=seat_holder_1,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        await session.refresh(seat1, ["subscription", "customer"])
        assert seat1.subscription is not None
        await session.refresh(
            seat1.subscription, ["product", "customer", "subscription_product_prices"]
        )
        assert seat1.subscription is not None
        await session.refresh(seat1.subscription.product, ["organization"])

        seat2 = await create_customer_seat(
            save_fixture,
            subscription=billing_manager_subscription,
            customer=seat_holder_2,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        await session.refresh(seat2, ["subscription", "customer"])
        assert seat2.subscription is not None
        await session.refresh(
            seat2.subscription, ["product", "customer", "subscription_product_prices"]
        )
        assert seat2.subscription is not None
        await session.refresh(seat2.subscription.product, ["organization"])

        timestamp = utc_now()
        events = [
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=1),
                organization=seat_org,
                customer=seat_holder_1,
                metadata={"tokens": 20, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=2),
                organization=seat_org,
                customer=seat_holder_2,
                metadata={"tokens": 10, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=3),
                organization=seat_org,
                customer=seat_holder_1,
                metadata={"tokens": 15, "model": "lite"},
            ),
        ]

        entries = await meter_service.create_billing_entries(session, meter)

        assert len(entries) == 3
        for entry in entries:
            assert entry.event is not None
            assert entry.customer == billing_manager
            assert entry.subscription == billing_manager_subscription
            assert entry.product_price == seat_product.prices[0]
            assert entry.direction == BillingEntryDirection.debit

        enqueue_job_mock.assert_called_once_with(
            "subscription.update_meters", billing_manager_subscription.id
        )

    async def test_billing_manager_is_seat_holder(
        self,
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        seat_org = await create_organization(
            save_fixture, feature_settings={"seat_based_pricing_enabled": True}
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
                func=AggregationFunction.sum, property="tokens"
            ),
            organization=seat_org,
        )

        billing_manager = await create_customer(save_fixture, organization=seat_org)

        seat_product = await create_product(
            save_fixture,
            organization=seat_org,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None), ("seat", 1000)],
        )

        billing_manager_subscription = await create_subscription_with_seats(
            save_fixture,
            product=seat_product,
            customer=billing_manager,
            seats=5,
        )
        await session.refresh(
            billing_manager_subscription, ["subscription_product_prices"]
        )

        seat_holder_2 = await create_customer(
            save_fixture,
            organization=seat_org,
            email="seat_holder_2@example.com",
        )

        seat1 = await create_customer_seat(
            save_fixture,
            subscription=billing_manager_subscription,
            customer=billing_manager,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        await session.refresh(seat1, ["subscription", "customer"])
        assert seat1.subscription is not None
        await session.refresh(
            seat1.subscription, ["product", "customer", "subscription_product_prices"]
        )
        assert seat1.subscription is not None
        await session.refresh(seat1.subscription.product, ["organization"])

        seat2 = await create_customer_seat(
            save_fixture,
            subscription=billing_manager_subscription,
            customer=seat_holder_2,
            status=SeatStatus.claimed,
            claimed_at=utc_now(),
        )
        await session.refresh(seat2, ["subscription", "customer"])
        assert seat2.subscription is not None
        await session.refresh(
            seat2.subscription, ["product", "customer", "subscription_product_prices"]
        )
        assert seat2.subscription is not None
        await session.refresh(seat2.subscription.product, ["organization"])

        timestamp = utc_now()
        events = [
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=1),
                organization=seat_org,
                customer=billing_manager,
                metadata={"tokens": 20, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=2),
                organization=seat_org,
                customer=seat_holder_2,
                metadata={"tokens": 10, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                timestamp=timestamp + timedelta(seconds=3),
                organization=seat_org,
                customer=billing_manager,
                metadata={"tokens": 15, "model": "lite"},
            ),
        ]

        entries = await meter_service.create_billing_entries(session, meter)

        assert len(entries) == 3
        for entry in entries:
            assert entry.event is not None
            assert entry.customer == billing_manager
            assert entry.subscription == billing_manager_subscription
            assert entry.product_price == seat_product.prices[0]
            assert entry.direction == BillingEntryDirection.debit

        enqueue_job_mock.assert_called_once_with(
            "subscription.update_meters", billing_manager_subscription.id
        )
