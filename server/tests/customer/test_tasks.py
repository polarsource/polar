import contextlib
from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.customer.service import customer as customer_service
from polar.customer.tasks import customer_event, customer_resolve_first_user_event_at
from polar.event.system import SystemEvent
from polar.models import Event, Organization
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_event


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


async def _get_event_metadata(
    session: AsyncSession, name: SystemEvent
) -> dict[str, str | None]:
    result = await session.execute(
        select(Event.user_metadata).where(Event.name == name)
    )
    return result.scalar_one()


@pytest.mark.asyncio
class TestCustomerResolveFirstUserEventAt:
    async def test_applies_the_earliest_event(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, external_id="EXTERNAL_ID"
        )
        first_user_event_at = customer.created_at - timedelta(days=30)
        get_first_user_event_at_mock = mocker.patch(
            "polar.customer.tasks.tinybird_service.get_first_user_event_at",
            return_value=first_user_event_at,
        )
        mocker.patch(
            "polar.customer.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await customer_resolve_first_user_event_at(customer.id)

        get_first_user_event_at_mock.assert_awaited_once_with(
            organization_id=organization.id,
            customer_id=customer.id,
            external_customer_id="EXTERNAL_ID",
        )
        await session.refresh(customer)
        assert customer.first_user_event_at == first_user_event_at

    async def test_no_events(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, external_id="EXTERNAL_ID"
        )
        get_first_user_event_at_mock = mocker.patch(
            "polar.customer.tasks.tinybird_service.get_first_user_event_at",
            return_value=None,
        )
        mocker.patch(
            "polar.customer.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await customer_resolve_first_user_event_at(customer.id)

        get_first_user_event_at_mock.assert_awaited_once()
        await session.refresh(customer)
        assert customer.first_user_event_at is None

    async def test_resolves_soft_deleted_customer(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """A customer can be soft-deleted between enqueue and execution."""
        customer = await create_customer(
            save_fixture, organization=organization, external_id="EXTERNAL_ID"
        )
        first_user_event_at = customer.created_at - timedelta(days=30)
        get_first_user_event_at_mock = mocker.patch(
            "polar.customer.tasks.tinybird_service.get_first_user_event_at",
            return_value=first_user_event_at,
        )
        await customer_service.delete(session, customer)
        await session.flush()
        mocker.patch(
            "polar.customer.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await customer_resolve_first_user_event_at(customer.id)

        get_first_user_event_at_mock.assert_awaited_once()
        await session.refresh(customer)
        assert customer.first_user_event_at == first_user_event_at

    async def test_falls_back_to_postgres(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """The aggregating views trail ingestion, so an event can be in Postgres only."""
        customer = await create_customer(
            save_fixture, organization=organization, external_id="EXTERNAL_ID"
        )
        timestamp = customer.created_at - timedelta(days=30)
        await create_event(
            save_fixture,
            organization=organization,
            external_customer_id="EXTERNAL_ID",
            source=EventSource.user,
            timestamp=timestamp,
        )
        mocker.patch(
            "polar.customer.tasks.tinybird_service.get_first_user_event_at",
            return_value=None,
        )
        mocker.patch(
            "polar.customer.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await customer_resolve_first_user_event_at(customer.id)

        await session.refresh(customer)
        assert customer.first_user_event_at == timestamp


@pytest.mark.asyncio
class TestCustomerEvent:
    async def test_deleted_reports_released_external_id(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Deletion releases the column, so the event reads it back from metadata."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="deleted@example.com",
            external_id="released-external-id",
        )
        await customer_service.delete(session, customer)
        await session.flush()
        assert customer.external_id is None

        mocker.patch(
            "polar.customer.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await customer_event(customer.id, SystemEvent.customer_deleted)

        metadata = await _get_event_metadata(session, SystemEvent.customer_deleted)
        assert metadata["customer_external_id"] == "released-external-id"

    async def test_created_reports_external_id(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="created@example.com",
            external_id="live-external-id",
        )

        mocker.patch(
            "polar.customer.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await customer_event(customer.id, SystemEvent.customer_created)

        metadata = await _get_event_metadata(session, SystemEvent.customer_created)
        assert metadata["customer_external_id"] == "live-external-id"
