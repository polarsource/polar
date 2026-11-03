from datetime import UTC, datetime

import pytest

from polar.billing_interval.repository import BillingIntervalRepository
from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.models import Customer, Meter, Product
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.reducer.types import UsageWindow
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription

EARLIER = datetime(2026, 1, 1, tzinfo=UTC)
LATER = datetime(2026, 1, 5, tzinfo=UTC)
CUTOFF = datetime(2026, 1, 10, tzinfo=UTC)


@pytest.mark.anyio
class TestGetUsageWindows:
    async def test_soft_deleted_earlier_subscription_owns_the_overlap(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        meter: Meter,
    ) -> None:
        subscriptions = []
        for started_at in (EARLIER, LATER):
            subscription = await create_subscription(
                save_fixture,
                product=product_recurring_metered,
                customer=customer,
                status=SubscriptionStatus.active,
                started_at=started_at,
                current_period_start=started_at,
            )
            await billing_interval_service.record_subscription(
                session, subscription, effective_at=started_at
            )
            subscriptions.append(subscription)
        earlier = subscriptions[0]
        earlier.deleted_at = LATER
        await save_fixture(earlier)
        [interval] = await BillingIntervalRepository.from_session(
            session
        ).get_by_subscription(earlier.id)

        windows = await billing_interval_service.get_usage_windows(
            session, customer, meter.id, cutoff=CUTOFF
        )

        assert windows == (
            UsageWindow(interval.id, earlier.id, meter.id, EARLIER, CUTOFF),
        )
