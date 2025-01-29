from datetime import timedelta

import pytest
from pydantic import ValidationError

from polar.auth.models import AuthSubject
from polar.event.repository import EventRepository
from polar.event.schemas import EventCreateExternalCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.exceptions import PolarRequestValidationError
from polar.kit.utils import utc_now
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture


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
