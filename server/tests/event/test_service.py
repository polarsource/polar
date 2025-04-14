import uuid
from datetime import timedelta
from unittest.mock import AsyncMock, call

import pytest
from pydantic import ValidationError
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject, is_user
from polar.event.repository import EventRepository
from polar.event.schemas import (
    EventCreateCustomer,
    EventCreateExternalCustomer,
    EventsIngest,
)
from polar.event.service import event as event_service
from polar.event.sorting import EventNamesSortProperty
from polar.exceptions import PolarRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import Customer, Organization, User, UserOrganization
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_event


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.event.service.enqueue_job")


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_not_organization_member(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        await create_event(save_fixture, organization=organization)

        events, count = await event_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(events) == 0
        assert count == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_event(save_fixture, organization=organization)

        events, count = await event_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(events) == 1
        assert count == 1

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event1 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() - timedelta(days=1),
            metadata={"tokens": 10},
        )
        event2 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() + timedelta(days=1),
            metadata={"tokens": 100},
        )

        events, count = await event_service.list(
            session,
            auth_subject,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="tokens",
                        operator=FilterOperator.gt,
                        value=50,
                    )
                ],
            ),
            pagination=PaginationParams(1, 10),
        )

        assert len(events) == 1
        assert count == 1
        assert events[0].id == event2.id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_after_before_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event1 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() - timedelta(days=1),
        )
        event2 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() + timedelta(days=1),
        )

        # Start timestamp
        events, count = await event_service.list(
            session,
            auth_subject,
            start_timestamp=utc_now(),
            pagination=PaginationParams(1, 10),
        )
        assert len(events) == 1
        assert count == 1
        assert events[0].id == event2.id

        # End timestamp
        events, count = await event_service.list(
            session,
            auth_subject,
            end_timestamp=utc_now(),
            pagination=PaginationParams(1, 10),
        )
        assert len(events) == 1
        assert count == 1
        assert events[0].id == event1.id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_metadata_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event1 = await create_event(
            save_fixture, organization=organization, metadata={"foo": "bar"}
        )
        await create_event(
            save_fixture, organization=organization, metadata={"foo": "baz"}
        )
        await create_event(
            save_fixture, organization=organization, metadata={"hello": "world"}
        )

        events, count = await event_service.list(
            session,
            auth_subject,
            metadata={"foo": ["bar"]},
            pagination=PaginationParams(1, 10),
        )

        assert len(events) == 1
        assert count == 1

        assert events[0].id == event1.id


@pytest.mark.asyncio
class TestGet:
    @pytest.mark.auth
    async def test_not_existing(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        result = await event_service.get(session, auth_subject, uuid.uuid4())

        assert result is None

    @pytest.mark.auth
    async def test_not_organization_member(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)

        result = await event_service.get(session, auth_subject, event.id)

        assert result is None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)

        result = await event_service.get(session, auth_subject, event.id)

        assert result is not None
        assert result.id == event.id


@pytest.mark.asyncio
class TestListNames:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_basic(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        for i in range(5):
            await create_event(save_fixture, organization=organization, name="event_1")
        for i in range(3):
            await create_event(save_fixture, organization=organization, name="event_2")

        event_names, count = await event_service.list_names(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
            sorting=[(EventNamesSortProperty.event_name, False)],
        )

        assert len(event_names) == 2
        event_1_name = event_names[0]
        assert event_1_name.name == "event_1"
        assert event_1_name.occurrences == 5

        event_2_name = event_names[1]
        assert event_2_name.name == "event_2"
        assert event_2_name.occurrences == 3

        assert count == 2


@pytest.mark.asyncio
class TestIngest:
    @pytest.mark.auth
    async def test_invalid_future_timestamp(self, organization: Organization) -> None:
        with pytest.raises(ValidationError):
            EventsIngest(
                events=[
                    EventCreateExternalCustomer(
                        name="test",
                        timestamp=utc_now() + timedelta(days=1),
                        external_customer_id="test",
                        organization_id=organization.id,
                    ),
                    EventCreateExternalCustomer(
                        name="test",
                        timestamp=utc_now() - timedelta(days=1),
                        external_customer_id="test",
                        organization_id=organization.id,
                    ),
                ]
            )

    @pytest.mark.auth
    async def test_invalid_user_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    organization_id=organization_second.id,
                ),
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                ),
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    organization_id=organization.id,
                ),
            ]
        )

        with pytest.raises(PolarRequestValidationError) as e:
            await event_service.ingest(session, auth_subject, ingest)

        errors = e.value.errors()
        assert len(errors) == 2

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_invalid_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    organization_id=organization.id,
                ),
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                ),
            ]
        )

        with pytest.raises(PolarRequestValidationError) as e:
            await event_service.ingest(session, auth_subject, ingest)

        errors = e.value.errors()
        assert len(errors) == 1

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_customer_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        customer_organization_second = await create_customer(
            save_fixture, organization=organization_second
        )

        ingest = EventsIngest(
            events=[
                EventCreateCustomer(
                    name="test",
                    customer_id=uuid.uuid4(),
                    organization_id=organization.id if is_user(auth_subject) else None,
                ),
                EventCreateCustomer(
                    name="test",
                    customer_id=customer_organization_second.id,
                    organization_id=organization.id if is_user(auth_subject) else None,
                ),
                EventCreateCustomer(
                    name="test",
                    customer_id=customer.id,
                    organization_id=organization.id if is_user(auth_subject) else None,
                ),
            ]
        )

        with pytest.raises(PolarRequestValidationError) as e:
            await event_service.ingest(session, auth_subject, ingest)

        errors = e.value.errors()
        assert len(errors) == 2

    @pytest.mark.auth
    async def test_valid_user(
        self,
        enqueue_job_mock: AsyncMock,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    organization_id=organization.id,
                )
                for _ in range(500)
            ]
        )

        await event_service.ingest(session, auth_subject, ingest)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(organization.id)
        assert len(events) == 500

        for event in events:
            assert event.source == EventSource.user

        enqueue_job_mock.assert_called_once_with(
            "event.ingested", event_ids=[event.id for event in events]
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_valid_organization(
        self,
        enqueue_job_mock: AsyncMock,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                )
                for _ in range(500)
            ]
        )

        await event_service.ingest(session, auth_subject, ingest)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(auth_subject.subject.id)
        assert len(events) == 500

        for event in events:
            assert event.source == EventSource.user

        enqueue_job_mock.assert_called_once_with(
            "event.ingested", event_ids=[event.id for event in events]
        )


@pytest.mark.asyncio
class TestIngested:
    async def test_basic(
        self,
        enqueue_job_mock: AsyncMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                customer=customer,
                organization=customer.organization,
                source=EventSource.user,
            ),
            await create_event(
                save_fixture,
                customer=customer,
                organization=customer.organization,
                source=EventSource.user,
            ),
            await create_event(
                save_fixture,
                customer=customer_second,
                organization=customer_second.organization,
                source=EventSource.user,
            ),
            await create_event(
                save_fixture,
                external_customer_id="UNLINKED_EXTERNAL_CUSTOMER_ID",
                organization=organization,
                source=EventSource.user,
            ),
        ]

        await event_service.ingested(session, [event.id for event in events])

        enqueue_job_mock.assert_has_calls(
            [
                call("customer_meter.update_customer", customer_id=customer.id),
                call("customer_meter.update_customer", customer_id=customer_second.id),
            ],
            any_order=True,
        )
