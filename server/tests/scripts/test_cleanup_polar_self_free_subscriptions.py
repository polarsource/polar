from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Event, Order, Organization, Product, Subscription
from polar.models.event import EventSource
from scripts.cleanup_polar_self_free_subscriptions import (
    _delete_events,
    _delete_events_tinybird,
    _delete_subscriptions,
    _delete_zero_orders,
    _list_event_ids,
    _list_free_subscription_ids,
    _list_zero_order_ids,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_product,
    create_subscription,
)


async def _make_free_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(None, "usd")],
    )


async def _make_paid_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(1000, "usd")],
    )


def _system_event(
    organization: Organization,
    *,
    name: str,
    user_metadata: dict[str, Any],
    customer: Customer | None = None,
    source: EventSource = EventSource.system,
) -> Event:
    return Event(
        name=name,
        source=source,
        organization_id=organization.id,
        customer_id=customer.id if customer is not None else None,
        external_customer_id=customer.external_id if customer is not None else None,
        user_metadata=user_metadata,
    )


@pytest.mark.asyncio
class TestListFreeSubscriptionIds:
    async def test_returns_only_subs_on_free_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        free_product = await _make_free_product(save_fixture, organization)
        paid_product = await _make_paid_product(save_fixture, organization)

        free_sub = await create_subscription(
            save_fixture, product=free_product, customer=customer
        )
        await create_subscription(save_fixture, product=paid_product, customer=customer)

        ids = await _list_free_subscription_ids(session, product_id=free_product.id)

        assert ids == [free_sub.id]

    async def test_excludes_soft_deleted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        free_product = await _make_free_product(save_fixture, organization)
        deleted_sub = await create_subscription(
            save_fixture, product=free_product, customer=customer
        )
        deleted_sub.set_deleted_at()
        await save_fixture(deleted_sub)

        live_sub = await create_subscription(
            save_fixture, product=free_product, customer=customer
        )

        ids = await _list_free_subscription_ids(session, product_id=free_product.id)

        assert ids == [live_sub.id]

    async def test_empty_when_no_matches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        free_product = await _make_free_product(save_fixture, organization)
        ids = await _list_free_subscription_ids(session, product_id=free_product.id)
        assert ids == []


@pytest.mark.asyncio
class TestListZeroOrderIds:
    async def test_returns_only_zero_orders_linked_to_subs(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        free_product = await _make_free_product(save_fixture, organization)
        paid_product = await _make_paid_product(save_fixture, organization)

        free_sub = await create_subscription(
            save_fixture, product=free_product, customer=customer
        )
        other_sub = await create_subscription(
            save_fixture, product=paid_product, customer=customer
        )

        zero_order = await create_order(
            save_fixture,
            customer=customer,
            product=free_product,
            subscription=free_sub,
            subtotal_amount=0,
            tax_amount=0,
        )
        # Paid order on the same sub: excluded.
        await create_order(
            save_fixture,
            customer=customer,
            product=free_product,
            subscription=free_sub,
            subtotal_amount=1000,
            tax_amount=0,
        )
        # $0 order on a different sub: excluded.
        await create_order(
            save_fixture,
            customer=customer,
            product=paid_product,
            subscription=other_sub,
            subtotal_amount=0,
            tax_amount=0,
        )
        # $0 order with no subscription: excluded.
        await create_order(
            save_fixture,
            customer=customer,
            product=free_product,
            subscription=None,
            subtotal_amount=0,
            tax_amount=0,
        )

        ids = await _list_zero_order_ids(
            session,
            organization_id=organization.id,
            subscription_ids=[free_sub.id],
        )

        assert ids == [zero_order.id]

    async def test_excludes_other_org(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        customer: Customer,
    ) -> None:
        free_product = await _make_free_product(save_fixture, organization)
        free_sub = await create_subscription(
            save_fixture, product=free_product, customer=customer
        )
        await create_order(
            save_fixture,
            customer=customer,
            product=free_product,
            subscription=free_sub,
            subtotal_amount=0,
            tax_amount=0,
        )

        ids = await _list_zero_order_ids(
            session,
            organization_id=organization_second.id,
            subscription_ids=[free_sub.id],
        )

        assert ids == []

    async def test_empty_subscription_list(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        ids = await _list_zero_order_ids(
            session, organization_id=organization.id, subscription_ids=[]
        )
        assert ids == []


@pytest.mark.asyncio
class TestListEventIds:
    async def test_matches_subscription_or_order_metadata(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        sub_id = str(uuid4())
        order_id = str(uuid4())
        other_sub_id = str(uuid4())

        sub_event = _system_event(
            organization,
            name="subscription.created",
            user_metadata={"subscription_id": sub_id, "product_id": "p"},
            customer=customer,
        )
        await save_fixture(sub_event)

        order_event = _system_event(
            organization,
            name="order.paid",
            user_metadata={"order_id": order_id, "amount": 0},
            customer=customer,
        )
        await save_fixture(order_event)

        other_event = _system_event(
            organization,
            name="subscription.created",
            user_metadata={"subscription_id": other_sub_id},
            customer=customer,
        )
        await save_fixture(other_event)

        ids = await _list_event_ids(
            session,
            organization_id=organization.id,
            subscription_ids=[UUID(sub_id)],
            order_ids=[UUID(order_id)],
        )

        assert set(ids) == {sub_event.id, order_event.id}

    async def test_excludes_user_source_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        sub_id = uuid4()
        user_event = _system_event(
            organization,
            name="subscription.created",
            user_metadata={"subscription_id": str(sub_id)},
            customer=customer,
            source=EventSource.user,
        )
        await save_fixture(user_event)

        ids = await _list_event_ids(
            session,
            organization_id=organization.id,
            subscription_ids=[sub_id],
            order_ids=[],
        )
        assert ids == []

    async def test_excludes_other_org(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        customer: Customer,
    ) -> None:
        sub_id = uuid4()
        cross_org_event = _system_event(
            organization_second,
            name="subscription.created",
            user_metadata={"subscription_id": str(sub_id)},
        )
        await save_fixture(cross_org_event)

        ids = await _list_event_ids(
            session,
            organization_id=organization.id,
            subscription_ids=[sub_id],
            order_ids=[],
        )
        assert ids == []

    async def test_empty_when_no_ids(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        ids = await _list_event_ids(
            session,
            organization_id=organization.id,
            subscription_ids=[],
            order_ids=[],
        )
        assert ids == []


@pytest.mark.asyncio
class TestDeleteZeroOrders:
    async def test_deletes_only_zero_orders_for_subs(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        free_product = await _make_free_product(save_fixture, organization)
        free_sub = await create_subscription(
            save_fixture, product=free_product, customer=customer
        )

        zero_order = await create_order(
            save_fixture,
            customer=customer,
            product=free_product,
            subscription=free_sub,
            subtotal_amount=0,
            tax_amount=0,
        )
        paid_order = await create_order(
            save_fixture,
            customer=customer,
            product=free_product,
            subscription=free_sub,
            subtotal_amount=1000,
            tax_amount=0,
        )

        deleted = await _delete_zero_orders(
            session,
            organization_id=organization.id,
            subscription_ids=[free_sub.id],
        )

        assert deleted == 1
        assert await session.get(Order, zero_order.id) is None
        assert await session.get(Order, paid_order.id) is not None


@pytest.mark.asyncio
class TestDeleteSubscriptions:
    async def test_deletes_listed_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        free_product = await _make_free_product(save_fixture, organization)
        sub_a = await create_subscription(
            save_fixture, product=free_product, customer=customer
        )
        sub_b = await create_subscription(
            save_fixture, product=free_product, customer=customer
        )

        deleted = await _delete_subscriptions(session, [sub_a.id])

        assert deleted == 1
        # Refresh by re-querying — session.get can return cached instances.
        remaining = (await session.execute(select(Subscription.id))).scalars().all()
        assert sub_a.id not in remaining
        assert sub_b.id in remaining


@pytest.mark.asyncio
class TestDeleteEvents:
    async def test_deletes_only_listed_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        kept = _system_event(
            organization,
            name="subscription.created",
            user_metadata={"subscription_id": str(uuid4())},
        )
        target = _system_event(
            organization,
            name="order.paid",
            user_metadata={"order_id": str(uuid4())},
        )
        await save_fixture(kept)
        await save_fixture(target)

        deleted = await _delete_events(session, [target.id])

        assert deleted == 1
        assert await session.get(Event, target.id) is None
        assert await session.get(Event, kept.id) is not None

    async def test_empty_list_is_noop(self, session: AsyncSession) -> None:
        assert await _delete_events(session, []) == 0


@pytest.mark.asyncio
class TestDeleteEventsTinybird:
    async def test_batches_ids_and_awaits_jobs(self, mocker: MockerFixture) -> None:
        delete_mock = mocker.patch(
            "scripts.cleanup_polar_self_free_subscriptions.tinybird_client.delete",
            new=AsyncMock(side_effect=lambda *args, **kwargs: {"job_id": "j-1"}),
        )
        get_job_mock = mocker.patch(
            "scripts.cleanup_polar_self_free_subscriptions.tinybird_client.get_job",
            new=AsyncMock(return_value={"status": "done", "rows_affected": 3}),
        )
        # Cap the batch size so we can assert multiple delete calls without
        # constructing 500+ UUIDs.
        mocker.patch(
            "scripts.cleanup_polar_self_free_subscriptions.TINYBIRD_DELETE_BATCH",
            2,
        )

        ids = [uuid4() for _ in range(5)]
        total = await _delete_events_tinybird(ids)

        assert total == 9  # 3 batches × 3 rows_affected
        assert delete_mock.await_count == 3
        first_condition = delete_mock.await_args_list[0].args[1]
        assert first_condition.startswith("id IN (")
        # Each ID rendered as a single-quoted UUID, comma-separated.
        for eid in ids[:2]:
            assert f"'{eid}'" in first_condition
        assert get_job_mock.await_count == 3

    async def test_empty_list_skips_request(self, mocker: MockerFixture) -> None:
        delete_mock = mocker.patch(
            "scripts.cleanup_polar_self_free_subscriptions.tinybird_client.delete",
            new=AsyncMock(),
        )
        total = await _delete_events_tinybird([])
        assert total == 0
        delete_mock.assert_not_called()
