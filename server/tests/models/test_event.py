import pytest

from polar.event.repository import EventRepository
from polar.kit.utils import utc_now
from polar.models import Customer, Event, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


@pytest.fixture
def repository(session: AsyncSession) -> EventRepository:
    return EventRepository.from_session(session)


@pytest.mark.asyncio
class TestCustomerComparatorEq:
    async def test_customer_id(
        self,
        save_fixture: SaveFixture,
        repository: EventRepository,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        event = await create_event(
            save_fixture,
            timestamp=utc_now(),
            organization=organization,
            customer=customer,
        )
        await create_event(
            save_fixture,
            timestamp=utc_now(),
            organization=organization,
            customer=customer_second,
        )

        statement = repository.get_base_statement().where(Event.customer == customer)
        result = await repository.get_one_or_none(statement)

        assert result is not None
        assert result == event

    async def test_customer_external_id(
        self,
        save_fixture: SaveFixture,
        repository: EventRepository,
        organization: Organization,
        customer_external_id: Customer,
        customer: Customer,
    ) -> None:
        event = await create_event(
            save_fixture,
            timestamp=utc_now(),
            organization=organization,
            external_customer_id=customer_external_id.external_id,
        )
        await create_event(
            save_fixture,
            timestamp=utc_now(),
            organization=organization,
            customer=customer,
        )

        statement = repository.get_base_statement().where(
            Event.customer == customer_external_id
        )
        result = await repository.get_one_or_none(statement)

        assert result is not None
        assert result == event


@pytest.mark.asyncio
class TestCustomerComparatorIs:
    async def test_customer_id(
        self,
        save_fixture: SaveFixture,
        repository: EventRepository,
        organization: Organization,
        customer: Customer,
    ) -> None:
        event = await create_event(
            save_fixture,
            timestamp=utc_now(),
            organization=organization,
            customer=customer,
        )

        statement = repository.get_base_statement().where(Event.customer.is_(None))
        result_is = await repository.get_one_or_none(statement)

        assert result_is is None

        statement = repository.get_base_statement().where(Event.customer.is_not(None))
        result_is_not = await repository.get_one_or_none(statement)

        assert result_is_not is not None
        assert result_is_not == event

    async def test_external_customer_id_existing(
        self,
        save_fixture: SaveFixture,
        repository: EventRepository,
        organization: Organization,
        customer_external_id: Customer,
    ) -> None:
        event = await create_event(
            save_fixture,
            timestamp=utc_now(),
            organization=organization,
            external_customer_id=customer_external_id.external_id,
        )

        statement = repository.get_base_statement().where(Event.customer.is_(None))
        result_is = await repository.get_one_or_none(statement)

        assert result_is is None

        statement = repository.get_base_statement().where(Event.customer.is_not(None))
        result_is_not = await repository.get_one_or_none(statement)

        assert result_is_not is not None
        assert result_is_not == event

    async def test_external_customer_id_not_existing(
        self,
        save_fixture: SaveFixture,
        repository: EventRepository,
        organization: Organization,
    ) -> None:
        event = await create_event(
            save_fixture,
            timestamp=utc_now(),
            organization=organization,
            external_customer_id="EXTERNAL_ID_123",
        )

        statement = repository.get_base_statement().where(Event.customer.is_(None))
        result_is = await repository.get_one_or_none(statement)

        assert result_is is not None
        assert result_is == event

        statement = repository.get_base_statement().where(Event.customer.is_not(None))
        result_is_not = await repository.get_one_or_none(statement)

        assert result_is_not is None
