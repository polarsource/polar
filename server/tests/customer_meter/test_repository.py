import uuid

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.customer_meter.repository import CustomerMeterRepository
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import Customer, CustomerMeter, Meter, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_meter


@pytest_asyncio.fixture
async def meter(save_fixture: SaveFixture, organization: Organization) -> Meter:
    return await create_meter(
        save_fixture,
        name=f"Usage {uuid.uuid4().hex[:8]}",
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


@pytest.mark.asyncio
class TestGetOrCreate:
    async def test_creates_when_missing(
        self, session: AsyncSession, customer: Customer, meter: Meter
    ) -> None:
        repository = CustomerMeterRepository.from_session(session)

        customer_meter = await repository.get_or_create(customer, meter)

        assert customer_meter.customer == customer
        assert customer_meter.meter == meter
        assert customer_meter.activated_at is None

    async def test_returns_existing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        existing = CustomerMeter(customer=customer, meter=meter)
        await save_fixture(existing)

        repository = CustomerMeterRepository.from_session(session)
        customer_meter = await repository.get_or_create(customer, meter)

        assert customer_meter == existing

    async def test_race_returns_existing_row_on_conflict(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        mocker: MockerFixture,
    ) -> None:
        """
        Simulate a concurrent transaction that created the row after our initial
        lookup returned nothing: the insert flush hits the unique constraint and
        the existing row must be re-fetched and returned instead of raising.
        """
        repository = CustomerMeterRepository.from_session(session)

        # A concurrent execution already created the row (flushed to the DB).
        concurrent = CustomerMeter(customer=customer, meter=meter)
        await repository.create(concurrent, flush=True)

        original = repository.get_by_customer_and_meter_for_update
        calls = 0

        async def side_effect(*args: object, **kwargs: object) -> CustomerMeter | None:
            nonlocal calls
            calls += 1
            # First lookup mimics the row not being visible yet, forcing the
            # insert path that then races with the concurrent transaction.
            if calls == 1:
                return None
            return await original(*args, **kwargs)  # type: ignore[arg-type]

        get_for_update = mocker.patch.object(
            repository,
            "get_by_customer_and_meter_for_update",
            side_effect=side_effect,
        )

        customer_meter = await repository.get_or_create(customer, meter)

        assert customer_meter == concurrent
        assert get_for_update.call_count == 2
