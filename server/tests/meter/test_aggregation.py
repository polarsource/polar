import pytest
from sqlalchemy import func, select

from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.models import Event, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


def test_strip_metadata_prefix() -> None:
    aggregation = PropertyAggregation(
        func=AggregationFunction.sum, property="metadata.property"
    )
    assert aggregation.property == "property"


async def _get_aggregation_result(
    session: AsyncSession, aggregation: Aggregation
) -> float:
    statement = select(func.coalesce(aggregation.get_sql_column(Event), 0.0)).where(
        aggregation.get_sql_clause(Event)
    )
    result = await session.execute(statement)
    return result.scalar_one()


@pytest.mark.asyncio
class TestPropertyAggregation:
    async def test_floating_number_property(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"property": 1.5},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"property": 1.5},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"property": 1},
            ),
        ]

        aggregation = PropertyAggregation(
            func=AggregationFunction.sum, property="metadata.property"
        )

        assert await _get_aggregation_result(session, aggregation) == 4.0

    async def test_non_numeric_metadata(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"property": 1.5},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"property": 1.5},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"property": "hello"},
            ),
        ]

        aggregation = PropertyAggregation(
            func=AggregationFunction.sum, property="metadata.property"
        )

        assert await _get_aggregation_result(session, aggregation) == 3.0

    async def test_non_numeric_field(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
            ),
        ]

        aggregation = PropertyAggregation(func=AggregationFunction.sum, property="name")

        assert await _get_aggregation_result(session, aggregation) == 0.0

    async def test_unique(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={
                    "value": "ID_1",
                },
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={
                    "value": "ID_1",
                },
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={
                    "value": "ID_1",
                },
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={
                    "value": "ID_2",
                },
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={
                    "value": "ID_3",
                },
            ),
        ]

        aggregation = UniqueAggregation(
            func=AggregationFunction.unique, property="value"
        )

        assert await _get_aggregation_result(session, aggregation) == 3.0
