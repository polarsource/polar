from datetime import timedelta
from decimal import Decimal

import pytest

from polar.kit.time_queries import TimeInterval
from polar.kit.utils import utc_now
from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
)
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.meter.service import meter as meter_service
from polar.models import Customer, Meter
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


@pytest.mark.asyncio
class TestGetQuantities:
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

        meter = Meter(
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

        meter = Meter(
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

        meter = Meter(
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

        meter = Meter(
            name="Lite Model Usage",
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[filter_clause],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
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
