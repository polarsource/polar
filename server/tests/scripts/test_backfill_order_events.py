import pytest

from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.models import Event, Organization, Product
from polar.models.event import EventSource
from polar.models.order import OrderStatus
from polar.models.refund import RefundStatus
from scripts.backfill_order_events import backfill_order_events
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_payment,
    create_refund,
)


@pytest.mark.asyncio
class TestBackfillOrderEvents:
    async def test_creates_order_paid_event_from_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,
        )

        await backfill_order_events(batch_size=2, rate_limit_delay=0.0, session=session)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(organization.id)

        paid_events = [e for e in events if e.name == SystemEvent.order_paid]
        assert len(paid_events) == 1
        assert paid_events[0].customer_id == customer.id
        assert paid_events[0].organization_id == organization.id
        assert paid_events[0].timestamp == order.created_at
        assert paid_events[0].user_metadata["order_id"] == str(order.id)

    async def test_creates_order_refunded_event_from_refund(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.refunded,
        )
        order.refunded_amount = order.net_amount
        order.refunded_tax_amount = order.tax_amount
        await save_fixture(order)
        payment = await create_payment(
            save_fixture, organization=organization, order=order
        )

        refund = await create_refund(
            save_fixture,
            order,
            payment,
            status=RefundStatus.succeeded,
            amount=order.net_amount,
            tax_amount=order.tax_amount,
        )

        await backfill_order_events(batch_size=2, rate_limit_delay=0.0, session=session)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(organization.id)

        refunded_events = [e for e in events if e.name == SystemEvent.order_refunded]
        assert len(refunded_events) == 1
        assert refunded_events[0].customer_id == customer.id
        assert refunded_events[0].timestamp == refund.created_at
        assert refunded_events[0].user_metadata["order_id"] == str(order.id)
        assert refunded_events[0].user_metadata["refunded_amount"] == refund.amount

    async def test_creates_multiple_refund_events_for_partial_refunds(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.partially_refunded,
        )
        order.refunded_amount = order.net_amount // 2
        order.refunded_tax_amount = order.tax_amount // 2
        await save_fixture(order)
        payment = await create_payment(
            save_fixture, organization=organization, order=order
        )

        refund_1 = await create_refund(
            save_fixture,
            order,
            payment,
            status=RefundStatus.succeeded,
            amount=order.net_amount // 4,
            tax_amount=order.tax_amount // 4,
            processor_id="refund_1",
        )

        refund_2 = await create_refund(
            save_fixture,
            order,
            payment,
            status=RefundStatus.succeeded,
            amount=order.net_amount // 4,
            tax_amount=order.tax_amount // 4,
            processor_id="refund_2",
        )

        await backfill_order_events(batch_size=2, rate_limit_delay=0.0, session=session)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(organization.id)

        refunded_events = [e for e in events if e.name == SystemEvent.order_refunded]
        assert len(refunded_events) == 2

        # Events should have timestamps matching the refunds, but order may vary
        event_timestamps = {e.timestamp for e in refunded_events}
        refund_timestamps = {refund_1.created_at, refund_2.created_at}
        assert event_timestamps == refund_timestamps

    async def test_skips_orders_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,
        )

        existing_event = Event(
            name=SystemEvent.order_paid,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "order_id": str(order.id),
                "amount": order.total_amount,
                "currency": order.currency,
            },
        )
        await save_fixture(existing_event)

        await backfill_order_events(batch_size=2, rate_limit_delay=0.0, session=session)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(organization.id)

        paid_events = [e for e in events if e.name == SystemEvent.order_paid]
        assert len(paid_events) == 1
        assert paid_events[0].id == existing_event.id

    async def test_skips_pending_orders(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        await backfill_order_events(batch_size=2, rate_limit_delay=0.0, session=session)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(organization.id)

        assert len(events) == 0
