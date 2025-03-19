import pytest
import pytest_asyncio

from polar.event.repository import EventRepository
from polar.kit.utils import utc_now
from polar.models import Customer, Event, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


@pytest_asyncio.fixture
def repository(session: AsyncSession) -> EventRepository:
    return EventRepository.from_session(session)


@pytest.mark.asyncio
class TestCustomerComparator:
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
