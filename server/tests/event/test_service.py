import uuid
from datetime import datetime, timedelta

import pytest
from pydantic import ValidationError

from polar.auth.models import AuthSubject
from polar.event.repository import EventRepository
from polar.event.schemas import EventCreateExternalCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.exceptions import PolarRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import Customer, Event, Organization, User, UserOrganization
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


async def create_event(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    name: str = "test",
    timestamp: datetime | None = None,
    customer: Customer | None = None,
    external_customer_id: str | None = None,
    metadata: dict[str, str | int | bool] | None = None,
) -> Event:
    event = Event(
        timestamp=timestamp or utc_now(),
        name=name,
        customer=customer,
        external_customer_id=external_customer_id,
        organization_id=organization.id,
        user_metadata=metadata or {},
    )
    await save_fixture(event)
    return event


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

        # Before
        events, count = await event_service.list(
            session,
            auth_subject,
            before=utc_now(),
            pagination=PaginationParams(1, 10),
        )
        assert len(events) == 1
        assert count == 1
        assert events[0].id == event1.id

        # After
        events, count = await event_service.list(
            session,
            auth_subject,
            after=utc_now(),
            pagination=PaginationParams(1, 10),
        )
        assert len(events) == 1
        assert count == 1
        assert events[0].id == event2.id

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

    @pytest.mark.auth
    async def test_valid_user(
        self,
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

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_valid_organization(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
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
