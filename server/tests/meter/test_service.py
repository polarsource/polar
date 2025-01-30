from decimal import Decimal

import pytest

from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    CountAggregation,
    FieldAggregation,
)
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.meter.service import meter as meter_service
from polar.models import Customer, Meter
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


@pytest.mark.asyncio
class TestGetValue:
    @pytest.mark.parametrize(
        "aggregation,expected_value",
        [
            (CountAggregation(), Decimal(4)),
            (
                FieldAggregation(function=AggregationFunction.sum, field="tokens"),
                Decimal(40),
            ),
            (
                FieldAggregation(function=AggregationFunction.max, field="tokens"),
                Decimal(20),
            ),
            (
                FieldAggregation(function=AggregationFunction.min, field="tokens"),
                Decimal(0),
            ),
            (
                FieldAggregation(function=AggregationFunction.avg, field="tokens"),
                Decimal(10),
            ),
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
        events = [
            await create_event(
                save_fixture,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 20, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 10, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 10, "model": "lite"},
            ),
            await create_event(
                save_fixture,
                organization=customer.organization,
                customer=customer,
                metadata={"tokens": 0, "model": "lite"},
            ),
            await create_event(
                save_fixture,
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
                        field="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=aggregation,
        )

        value = await meter_service.get_value(session, meter, customer_id=customer.id)

        assert value == expected_value

    @pytest.mark.parametrize(
        "field",
        [
            pytest.param("model", id="not a numeric field"),
            pytest.param("tokns", id="non existing field"),
        ],
    )
    async def test_invalid_aggregation_field(
        self,
        field: str,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        await create_event(
            save_fixture,
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
                        field="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=FieldAggregation(function=AggregationFunction.sum, field=field),
        )

        value = await meter_service.get_value(session, meter, customer_id=customer.id)
        assert value == 0

    @pytest.mark.parametrize(
        "filter_clause",
        [
            pytest.param(
                FilterClause(field="model", operator=FilterOperator.eq, value=100),
                id="value not matching metadata field type",
            ),
            pytest.param(
                FilterClause(
                    field="tokens", operator=FilterOperator.like, value="lite"
                ),
                id="operator not matching metadata field type",
            ),
            pytest.param(
                FilterClause(field="name", operator=FilterOperator.eq, value=100),
                id="operator not matching field type",
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
        await create_event(
            save_fixture,
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
            aggregation=FieldAggregation(
                function=AggregationFunction.sum, field="tokens"
            ),
        )

        value = await meter_service.get_value(session, meter, customer_id=customer.id)
        assert value == 0
