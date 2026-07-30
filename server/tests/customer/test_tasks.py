import contextlib
from collections.abc import AsyncIterator

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.customer.service import customer as customer_service
from polar.customer.tasks import customer_event
from polar.event.system import SystemEvent
from polar.models import Event, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


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
