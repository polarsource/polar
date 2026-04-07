from uuid import uuid4

import pytest
from sqlalchemy import func, select

from polar.kit.db.postgres import AsyncSession
from polar.models import Event, Organization
from polar.models.event import EventSource
from scripts.cleanup_duplicate_balance_events import (
    delete_stale_events,
    find_stale_events,
)
from tests.fixtures.database import SaveFixture


def _balance_order_event(
    organization: Organization, *, order_id: str, fee: int
) -> Event:
    return Event(
        name="balance.order",
        source=EventSource.system,
        organization_id=organization.id,
        user_metadata={"order_id": order_id, "fee": fee, "amount": 1000},
    )


@pytest.mark.asyncio
class TestFindStaleEvents:
    async def test_finds_fee_zero_duplicates(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        order_id = str(uuid4())
        stale = _balance_order_event(organization, order_id=order_id, fee=0)
        await save_fixture(stale)
        correct = _balance_order_event(organization, order_id=order_id, fee=95)
        await save_fixture(correct)

        result = await find_stale_events(session)

        assert len(result) == 1
        assert result[0].id == stale.id

    async def test_ignores_single_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        order_id = str(uuid4())
        event = _balance_order_event(organization, order_id=order_id, fee=95)
        await save_fixture(event)

        result = await find_stale_events(session)

        assert len(result) == 0

    async def test_ignores_single_fee_zero_event(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        order_id = str(uuid4())
        event = _balance_order_event(organization, order_id=order_id, fee=0)
        await save_fixture(event)

        result = await find_stale_events(session)

        assert len(result) == 0

    async def test_multiple_orders(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        for _ in range(3):
            order_id = str(uuid4())
            await save_fixture(
                _balance_order_event(organization, order_id=order_id, fee=0)
            )
            await save_fixture(
                _balance_order_event(organization, order_id=order_id, fee=80)
            )

        clean_order_id = str(uuid4())
        await save_fixture(
            _balance_order_event(organization, order_id=clean_order_id, fee=100)
        )

        result = await find_stale_events(session)

        assert len(result) == 3
        for event in result:
            assert event.user_metadata["fee"] == 0

    async def test_multiple_orgs(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        order1 = str(uuid4())
        await save_fixture(_balance_order_event(organization, order_id=order1, fee=0))
        await save_fixture(_balance_order_event(organization, order_id=order1, fee=95))

        order2 = str(uuid4())
        await save_fixture(
            _balance_order_event(organization_second, order_id=order2, fee=0)
        )
        await save_fixture(
            _balance_order_event(organization_second, order_id=order2, fee=106)
        )

        result = await find_stale_events(session)

        assert len(result) == 2
        org_ids = {e.organization_id for e in result}
        assert org_ids == {organization.id, organization_second.id}


@pytest.mark.asyncio
class TestDeleteStaleEvents:
    async def test_deletes_only_stale_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        order_id = str(uuid4())
        stale = _balance_order_event(organization, order_id=order_id, fee=0)
        await save_fixture(stale)
        correct = _balance_order_event(organization, order_id=order_id, fee=95)
        await save_fixture(correct)

        stale_events = await find_stale_events(session)
        deleted = await delete_stale_events(session, stale_events)

        assert deleted == 1

        remaining = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(
                    Event.name == "balance.order",
                    Event.source == "system",
                )
            )
        ).scalar_one()
        assert remaining == 1

        kept = await session.get(Event, correct.id)
        assert kept is not None
        assert kept.user_metadata["fee"] == 95

        gone = await session.get(Event, stale.id)
        assert gone is None
