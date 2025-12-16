from datetime import UTC, datetime

import pytest

from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.models import Event, Organization, Product
from polar.models.event import EventSource
from polar.models.subscription import SubscriptionStatus
from scripts.backfill_system_events import (
    backfill_order_paid_metadata,
    backfill_subscription_canceled_metadata,
    backfill_subscription_created_canceled_product_id,
    backfill_subscription_cycled_metadata,
    backfill_subscription_revoked_metadata,
    create_missing_checkout_created_events,
    create_missing_subscription_canceled_events,
    create_missing_subscription_created_events,
    create_missing_subscription_revoked_events,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_customer,
    create_order,
    create_subscription,
)


@pytest.mark.asyncio
class TestBackfillOrderPaidMetadata:
    async def test_updates_missing_metadata(
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
        )

        event = Event(
            name=SystemEvent.order_paid,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "order_id": str(order.id),
                "amount": order.total_amount,
            },
        )
        await save_fixture(event)

        updated = await backfill_order_paid_metadata(
            session, batch_size=10, rate_limit_delay=0
        )

        assert updated == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.order_paid)

        assert len(events) == 1
        metadata = events[0].user_metadata
        assert metadata["currency"] == order.currency
        assert metadata["net_amount"] == order.net_amount
        assert metadata["tax_amount"] == order.tax_amount
        assert metadata["platform_fee"] == order.platform_fee_amount

    async def test_skips_events_with_existing_metadata(
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
        )

        event = Event(
            name=SystemEvent.order_paid,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "order_id": str(order.id),
                "amount": order.total_amount,
                "currency": order.currency,
                "net_amount": order.net_amount,
            },
        )
        await save_fixture(event)

        updated = await backfill_order_paid_metadata(
            session, batch_size=10, rate_limit_delay=0
        )

        assert updated == 0


@pytest.mark.asyncio
class TestBackfillSubscriptionRevokedMetadata:
    async def test_updates_missing_metadata(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=datetime.now(UTC),
            revoke=True,
        )

        event = Event(
            name=SystemEvent.subscription_revoked,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "subscription_id": str(subscription.id),
            },
        )
        await save_fixture(event)

        updated = await backfill_subscription_revoked_metadata(
            session, batch_size=10, rate_limit_delay=0
        )

        assert updated == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_revoked
        )

        assert len(events) == 1
        metadata = events[0].user_metadata
        assert metadata["amount"] == subscription.amount
        assert metadata["currency"] == subscription.currency
        assert metadata["recurring_interval"] == subscription.recurring_interval.value
        assert (
            metadata["recurring_interval_count"]
            == subscription.recurring_interval_count
        )


@pytest.mark.asyncio
class TestBackfillSubscriptionCycledMetadata:
    async def test_updates_missing_metadata(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=datetime.now(UTC),
        )

        event = Event(
            name=SystemEvent.subscription_cycled,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "subscription_id": str(subscription.id),
            },
        )
        await save_fixture(event)

        updated = await backfill_subscription_cycled_metadata(
            session, batch_size=10, rate_limit_delay=0
        )

        assert updated == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.subscription_cycled)

        assert len(events) == 1
        metadata = events[0].user_metadata
        assert metadata["amount"] == subscription.amount
        assert metadata["currency"] == subscription.currency
        assert metadata["recurring_interval"] == subscription.recurring_interval.value
        assert (
            metadata["recurring_interval_count"]
            == subscription.recurring_interval_count
        )


@pytest.mark.asyncio
class TestBackfillSubscriptionCanceledMetadata:
    async def test_updates_missing_metadata(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=datetime.now(UTC),
            cancel_at_period_end=True,
        )

        event = Event(
            name=SystemEvent.subscription_canceled,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "subscription_id": str(subscription.id),
                "canceled_at": subscription.canceled_at.isoformat()
                if subscription.canceled_at
                else "",
            },
        )
        await save_fixture(event)

        updated = await backfill_subscription_canceled_metadata(
            session, batch_size=10, rate_limit_delay=0
        )

        assert updated == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_canceled
        )

        assert len(events) == 1
        metadata = events[0].user_metadata
        assert metadata["amount"] == subscription.amount
        assert metadata["currency"] == subscription.currency
        assert metadata["recurring_interval"] == subscription.recurring_interval.value
        assert (
            metadata["recurring_interval_count"]
            == subscription.recurring_interval_count
        )
        assert metadata["cancel_at_period_end"] == subscription.cancel_at_period_end


@pytest.mark.asyncio
class TestCreateMissingSubscriptionCreatedEvents:
    async def test_creates_events_for_subscriptions_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=datetime.now(UTC),
        )

        created = await create_missing_subscription_created_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_created
        )

        assert len(events) == 1
        event = events[0]
        assert event.customer_id == customer.id
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.user_metadata["product_id"] == str(subscription.product_id)
        assert event.user_metadata["amount"] == subscription.amount
        assert event.user_metadata["currency"] == subscription.currency

    async def test_skips_subscriptions_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=datetime.now(UTC),
        )

        existing_event = Event(
            name=SystemEvent.subscription_created,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "subscription_id": str(subscription.id),
            },
        )
        await save_fixture(existing_event)

        created = await create_missing_subscription_created_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0


@pytest.mark.asyncio
class TestCreateMissingSubscriptionCanceledEvents:
    async def test_creates_events_for_canceled_subscriptions_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=datetime.now(UTC),
            cancel_at_period_end=True,
        )

        created = await create_missing_subscription_canceled_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_canceled
        )

        assert len(events) == 1
        event = events[0]
        assert event.customer_id == customer.id
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.user_metadata["amount"] == subscription.amount
        assert event.user_metadata["currency"] == subscription.currency
        assert (
            event.user_metadata["recurring_interval"]
            == subscription.recurring_interval.value
        )
        assert (
            event.user_metadata["recurring_interval_count"]
            == subscription.recurring_interval_count
        )
        assert "canceled_at" in event.user_metadata
        assert (
            event.user_metadata["cancel_at_period_end"]
            == subscription.cancel_at_period_end
        )


@pytest.mark.asyncio
class TestCreateMissingSubscriptionRevokedEvents:
    async def test_creates_events_for_revoked_subscriptions_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=datetime.now(UTC),
            revoke=True,
        )

        created = await create_missing_subscription_revoked_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_revoked
        )

        assert len(events) == 1
        event = events[0]
        assert event.customer_id == customer.id
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.user_metadata["product_id"] == str(subscription.product_id)
        assert event.user_metadata["amount"] == subscription.amount
        assert event.user_metadata["currency"] == subscription.currency
        assert (
            event.user_metadata["recurring_interval"]
            == subscription.recurring_interval.value
        )
        assert (
            event.user_metadata["recurring_interval_count"]
            == subscription.recurring_interval_count
        )

    async def test_skips_subscriptions_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=datetime.now(UTC),
            revoke=True,
        )

        existing_event = Event(
            name=SystemEvent.subscription_revoked,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "subscription_id": str(subscription.id),
            },
        )
        await save_fixture(existing_event)

        created = await create_missing_subscription_revoked_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0


@pytest.mark.asyncio
class TestCreateMissingCheckoutCreatedEvents:
    async def test_creates_events_for_checkouts_without_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
        )

        created = await create_missing_checkout_created_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.checkout_created)

        assert len(events) == 1
        event = events[0]
        assert event.customer_id is None
        assert event.organization_id == checkout.organization_id
        assert event.user_metadata["checkout_id"] == str(checkout.id)
        assert event.user_metadata["product_id"] == str(checkout.product_id)

    async def test_skips_checkouts_with_existing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
        )

        existing_event = Event(
            name=SystemEvent.checkout_created,
            source=EventSource.system,
            customer_id=None,
            organization_id=checkout.organization_id,
            user_metadata={
                "checkout_id": str(checkout.id),
                "checkout_status": "open",
            },
        )
        await save_fixture(existing_event)

        created = await create_missing_checkout_created_events(
            session, batch_size=10, rate_limit_delay=0
        )

        assert created == 0


@pytest.mark.asyncio
class TestBackfillSubscriptionCreatedCanceledProductId:
    async def test_backfills_product_id_and_creates_missing_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)

        sub1 = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=datetime.now(UTC),
        )
        event_with_product_id = Event(
            name=SystemEvent.subscription_created,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "subscription_id": str(sub1.id),
                "product_id": str(sub1.product_id),
                "amount": sub1.amount,
                "currency": sub1.currency,
                "recurring_interval": sub1.recurring_interval.value,
                "recurring_interval_count": sub1.recurring_interval_count,
                "started_at": sub1.started_at.isoformat() if sub1.started_at else "",
            },
        )
        await save_fixture(event_with_product_id)

        sub2 = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=datetime.now(UTC),
        )
        event_without_product_id = Event(
            name=SystemEvent.subscription_created,
            source=EventSource.system,
            customer_id=customer.id,
            organization_id=organization.id,
            user_metadata={
                "subscription_id": str(sub2.id),
                "amount": sub2.amount,
                "currency": sub2.currency,
                "recurring_interval": sub2.recurring_interval.value,
                "recurring_interval_count": sub2.recurring_interval_count,
                "started_at": sub2.started_at.isoformat() if sub2.started_at else "",
            },
        )
        await save_fixture(event_without_product_id)

        sub3 = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=datetime.now(UTC),
        )

        created = await create_missing_subscription_created_events(
            session, batch_size=10, rate_limit_delay=0
        )
        assert created == 1

        updated = await backfill_subscription_created_canceled_product_id(
            session, batch_size=10, rate_limit_delay=0
        )
        assert updated == 1

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_created
        )

        assert len(events) == 3

        events_by_sub_id = {e.user_metadata["subscription_id"]: e for e in events}

        assert events_by_sub_id[str(sub1.id)].user_metadata["product_id"] == str(
            sub1.product_id
        )
        assert events_by_sub_id[str(sub2.id)].user_metadata["product_id"] == str(
            sub2.product_id
        )
        assert events_by_sub_id[str(sub3.id)].user_metadata["product_id"] == str(
            sub3.product_id
        )
