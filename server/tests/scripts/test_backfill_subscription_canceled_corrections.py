from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.models import Event, Organization, Product
from polar.models.event import EventSource
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from scripts.backfill_subscription_canceled_corrections import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_event,
    create_subscription,
)


def _event_canceled_at(event: Event) -> datetime | None:
    canceled_at = (
        event.user_metadata.get("canceled_at") if event.user_metadata else None
    )
    if not isinstance(canceled_at, str) or canceled_at == "":
        return None
    return datetime.fromisoformat(canceled_at.replace("Z", "+00:00"))


@pytest.mark.asyncio
class TestBackfillSubscriptionCanceledCorrections:
    async def test_does_not_add_corrective_event_within_15_minute_leeway(
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
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
            cancel_at_period_end=True,
        )
        subscription.canceled_at = datetime(2026, 1, 20, 10, 0, tzinfo=UTC)
        subscription.ends_at = datetime(2026, 2, 1, 10, 0, tzinfo=UTC)
        subscription.customer_cancellation_reason = CustomerCancellationReason.unused
        await save_fixture(subscription)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.subscription_canceled.value,
            timestamp=datetime(2026, 1, 20, 10, 10, tzinfo=UTC),
            metadata={
                "subscription_id": str(subscription.id),
                "canceled_at": datetime(2026, 1, 20, 10, 10, tzinfo=UTC).isoformat(),
                "customer_cancellation_reason": CustomerCancellationReason.unused.value,
            },
        )

        result = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )

        assert result["affected_subscriptions"] == 0
        assert result["corrective_events_inserted"] == 0

    async def test_handles_null_cancellation_reason_without_crashing(
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
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
            cancel_at_period_end=True,
        )
        subscription.canceled_at = datetime(2026, 1, 20, 10, 0, tzinfo=UTC)
        subscription.ends_at = datetime(2026, 2, 1, 10, 0, tzinfo=UTC)
        subscription.customer_cancellation_reason = None
        await save_fixture(subscription)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.subscription_canceled.value,
            timestamp=datetime(2026, 1, 20, 10, 45, tzinfo=UTC),
            metadata={
                "subscription_id": str(subscription.id),
                "canceled_at": datetime(2026, 1, 20, 10, 45, tzinfo=UTC).isoformat(),
                "customer_cancellation_reason": "unused",
            },
        )

        result = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )

        assert result["affected_subscriptions"] == 1
        assert result["corrective_events_inserted"] == 1

        events = (
            (
                await session.execute(
                    select(Event).where(
                        Event.name == SystemEvent.subscription_canceled,
                        Event.source == EventSource.system,
                        Event.user_metadata["subscription_id"].as_string()
                        == str(subscription.id),
                    )
                )
            )
            .scalars()
            .all()
        )

        corrected_event = next(
            event
            for event in events
            if event.user_metadata.get("canceled_at")
            == subscription.canceled_at.isoformat()
        )
        assert "customer_cancellation_reason" not in corrected_event.user_metadata

    async def test_adds_corrective_event_when_canceled_hour_differs_same_day(
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
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
            cancel_at_period_end=True,
        )
        subscription.canceled_at = datetime(2026, 1, 20, 10, 0, tzinfo=UTC)
        subscription.ends_at = datetime(2026, 2, 1, 10, 0, tzinfo=UTC)
        subscription.customer_cancellation_reason = CustomerCancellationReason.unused
        await save_fixture(subscription)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.subscription_canceled.value,
            timestamp=datetime(2026, 1, 20, 11, 0, tzinfo=UTC),
            metadata={
                "subscription_id": str(subscription.id),
                "canceled_at": datetime(2026, 1, 20, 15, 0, tzinfo=UTC).isoformat(),
                "customer_cancellation_reason": CustomerCancellationReason.unused.value,
            },
        )

        result = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )

        assert result["affected_subscriptions"] == 1
        assert result["corrective_events_inserted"] == 1

    async def test_adds_corrective_event_when_canceled_day_differs(
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
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
            cancel_at_period_end=True,
        )
        subscription.canceled_at = datetime(2026, 1, 20, 10, 0, tzinfo=UTC)
        subscription.ends_at = datetime(2026, 2, 1, 10, 0, tzinfo=UTC)
        subscription.customer_cancellation_reason = CustomerCancellationReason.unused
        await save_fixture(subscription)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.subscription_canceled.value,
            timestamp=datetime(2026, 1, 25, 9, 0, tzinfo=UTC),
            metadata={
                "subscription_id": str(subscription.id),
                "canceled_at": datetime(2026, 1, 10, 9, 0, tzinfo=UTC).isoformat(),
                "customer_cancellation_reason": CustomerCancellationReason.unused.value,
            },
        )

        result = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )

        assert result["affected_subscriptions"] == 1
        assert result["corrective_events_inserted"] == 1
        assert result["tinybird_events_ingested"] == 0

        events = (
            (
                await session.execute(
                    select(Event).where(
                        Event.name == SystemEvent.subscription_canceled,
                        Event.source == EventSource.system,
                        Event.user_metadata["subscription_id"].as_string()
                        == str(subscription.id),
                    )
                )
            )
            .scalars()
            .all()
        )

        assert len(events) == 2

        latest_event = max(
            events,
            key=lambda event: (
                _event_canceled_at(event) or datetime(1970, 1, 1, tzinfo=UTC),
                event.timestamp,
                event.ingested_at,
                str(event.id),
            ),
        )
        assert _event_canceled_at(latest_event) == subscription.canceled_at
        assert (
            latest_event.user_metadata["customer_cancellation_reason"]
            == CustomerCancellationReason.unused.value
        )

    async def test_adds_corrective_event_when_reason_bucket_differs(
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
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
            cancel_at_period_end=True,
        )
        subscription.canceled_at = datetime(2026, 1, 20, 10, 0, tzinfo=UTC)
        subscription.ends_at = datetime(2026, 2, 1, 10, 0, tzinfo=UTC)
        subscription.customer_cancellation_reason = (
            CustomerCancellationReason.missing_features
        )
        await save_fixture(subscription)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.subscription_canceled.value,
            timestamp=subscription.canceled_at,
            metadata={
                "subscription_id": str(subscription.id),
                "canceled_at": subscription.canceled_at.isoformat(),
                "customer_cancellation_reason": CustomerCancellationReason.other.value,
            },
        )

        result = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )

        assert result["affected_subscriptions"] == 1
        assert result["corrective_events_inserted"] == 1

        events = (
            (
                await session.execute(
                    select(Event).where(
                        Event.name == SystemEvent.subscription_canceled,
                        Event.source == EventSource.system,
                        Event.user_metadata["subscription_id"].as_string()
                        == str(subscription.id),
                    )
                )
            )
            .scalars()
            .all()
        )

        assert len(events) == 2

        latest_event = max(
            events,
            key=lambda event: (
                _event_canceled_at(event) or datetime(1970, 1, 1, tzinfo=UTC),
                event.timestamp,
                event.ingested_at,
                str(event.id),
            ),
        )
        assert (
            latest_event.user_metadata["customer_cancellation_reason"]
            == CustomerCancellationReason.missing_features.value
        )

    async def test_is_idempotent_after_first_run(
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
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
            cancel_at_period_end=True,
        )
        subscription.canceled_at = datetime(2026, 1, 20, 10, 0, tzinfo=UTC)
        subscription.ends_at = datetime(2026, 2, 1, 10, 0, tzinfo=UTC)
        subscription.customer_cancellation_reason = (
            CustomerCancellationReason.low_quality
        )
        await save_fixture(subscription)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.subscription_canceled.value,
            timestamp=datetime(2026, 1, 22, 9, 0, tzinfo=UTC),
            metadata={
                "subscription_id": str(subscription.id),
                "canceled_at": datetime(2026, 1, 10, 9, 0, tzinfo=UTC).isoformat(),
                "customer_cancellation_reason": CustomerCancellationReason.other.value,
            },
        )

        first_run = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )
        second_run = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )

        assert first_run["corrective_events_inserted"] == 1
        assert second_run["corrective_events_inserted"] == 0
        assert second_run["affected_subscriptions"] == 0

        events = (
            (
                await session.execute(
                    select(Event).where(
                        Event.name == SystemEvent.subscription_canceled,
                        Event.source == EventSource.system,
                        Event.user_metadata["subscription_id"].as_string()
                        == str(subscription.id),
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(events) == 2

    async def test_is_idempotent_when_bad_event_ranks_after_canceled_at(
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
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
            cancel_at_period_end=True,
        )
        subscription.canceled_at = datetime(2026, 1, 20, 10, 0, tzinfo=UTC)
        subscription.ends_at = datetime(2026, 2, 1, 10, 0, tzinfo=UTC)
        subscription.customer_cancellation_reason = (
            CustomerCancellationReason.missing_features
        )
        await save_fixture(subscription)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.subscription_canceled.value,
            timestamp=datetime(2026, 1, 25, 10, 0, tzinfo=UTC),
            metadata={
                "subscription_id": str(subscription.id),
                "canceled_at": subscription.canceled_at.isoformat(),
                "customer_cancellation_reason": CustomerCancellationReason.other.value,
            },
        )

        first_run = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )
        second_run = await run_backfill(
            subscription_batch_size=10,
            insert_batch_size=10,
            rate_limit_delay=0,
            ingest_tinybird=False,
            session=session,
        )

        assert first_run["corrective_events_inserted"] == 1
        assert second_run["corrective_events_inserted"] == 0

        events = (
            (
                await session.execute(
                    select(Event).where(
                        Event.name == SystemEvent.subscription_canceled,
                        Event.source == EventSource.system,
                        Event.user_metadata["subscription_id"].as_string()
                        == str(subscription.id),
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(events) == 2
