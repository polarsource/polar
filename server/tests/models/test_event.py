import pytest
from sqlalchemy.orm import joinedload

from polar.event.repository import EventRepository
from polar.kit.utils import utc_now
from polar.models import Customer, Event, EventType, Organization
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_event


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


@pytest.mark.asyncio
class TestCustomerRelationship:
    async def test_conflicting_external_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        """
        Ensures that even if two customers have the same external ID on different organizations,
        we do not join the customer from the second organization when querying an event from the first organization.
        """
        await create_customer(
            save_fixture,
            organization=organization_second,
            external_id="EXTERNAL_ID_123",
        )

        event = await create_event(
            save_fixture,
            timestamp=utc_now(),
            organization=organization,
            external_customer_id="EXTERNAL_ID_123",
        )

        repository = EventRepository.from_session(session)
        loaded_event = await repository.get_by_id(
            event.id, options=(joinedload(Event.customer),)
        )

        assert loaded_event is not None
        assert loaded_event.customer is None


@pytest.mark.asyncio
class TestEventLabel:
    async def test_label_with_property_selector(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        event_type = EventType(
            name="support.request",
            label="Support Request",
            label_property_selector="subject",
            organization_id=organization.id,
        )
        await save_fixture(event_type)

        event = Event(
            name="support.request",
            source=EventSource.user,
            organization_id=organization.id,
            event_type_id=event_type.id,
            user_metadata={"subject": "Billing complaint"},
        )
        await save_fixture(event)

        repository = EventRepository.from_session(session)
        loaded_event = await repository.get_by_id(
            event.id, options=(joinedload(Event.event_types),)
        )

        assert loaded_event is not None
        assert loaded_event.label == "Billing complaint"

    async def test_label_without_property_selector(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        event_type = EventType(
            name="api.request",
            label="API Request",
            label_property_selector=None,
            organization_id=organization.id,
        )
        await save_fixture(event_type)

        event = Event(
            name="api.request",
            source=EventSource.user,
            organization_id=organization.id,
            event_type_id=event_type.id,
            user_metadata={"endpoint": "/api/users"},
        )
        await save_fixture(event)

        repository = EventRepository.from_session(session)
        loaded_event = await repository.get_by_id(
            event.id, options=(joinedload(Event.event_types),)
        )

        assert loaded_event is not None
        assert loaded_event.label == "API Request"

    async def test_label_with_nested_metadata_path(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        event_type = EventType(
            name="llm.call",
            label="LLM Call",
            label_property_selector="metadata.model",
            organization_id=organization.id,
        )
        await save_fixture(event_type)

        event = Event(
            name="llm.call",
            source=EventSource.user,
            organization_id=organization.id,
            event_type_id=event_type.id,
            user_metadata={"metadata": {"model": "gpt-4"}},
        )
        await save_fixture(event)

        repository = EventRepository.from_session(session)
        loaded_event = await repository.get_by_id(
            event.id, options=(joinedload(Event.event_types),)
        )

        assert loaded_event is not None
        assert loaded_event.label == "gpt-4"

    async def test_label_with_missing_metadata_value(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        event_type = EventType(
            name="support.request",
            label="Support Request",
            label_property_selector="subject",
            organization_id=organization.id,
        )
        await save_fixture(event_type)

        event = Event(
            name="support.request",
            source=EventSource.user,
            organization_id=organization.id,
            event_type_id=event_type.id,
            user_metadata={"category": "billing"},
        )
        await save_fixture(event)

        repository = EventRepository.from_session(session)
        loaded_event = await repository.get_by_id(
            event.id, options=(joinedload(Event.event_types),)
        )

        assert loaded_event is not None
        assert loaded_event.label == "Support Request"
