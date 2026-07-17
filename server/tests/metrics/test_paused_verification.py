from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.enums import SubscriptionRecurringInterval
from polar.kit.time_queries import TimeInterval
from polar.metrics.service import metrics as metrics_service
from polar.models import Organization, User, UserOrganization
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_customer,
    create_product,
)

SQL_METRICS = [
    "active_subscriptions",
    "monthly_recurring_revenue",
    "churn_rate",
    "churned_subscriptions",
]


@pytest.mark.asyncio
async def test_paused_subscription_in_metrics(
    session: AsyncSession,
    save_fixture: SaveFixture,
    user: User,
    organization: Organization,
    user_organization: UserOrganization,
) -> None:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(1000, "usd")],
    )
    started_at = datetime(2024, 1, 1, tzinfo=UTC)

    active_customer = await create_customer(
        save_fixture, organization=organization, email="active@example.com"
    )
    active_sub = await create_active_subscription(
        save_fixture,
        product=product,
        customer=active_customer,
        started_at=started_at,
    )

    paused_customer = await create_customer(
        save_fixture, organization=organization, email="paused@example.com"
    )
    paused_sub = await create_active_subscription(
        save_fixture,
        product=product,
        customer=paused_customer,
        started_at=started_at,
    )
    # Mirror the cycle() pause transition: status flips, paused_at is stamped,
    # ended_at / ends_at / canceled_at stay untouched.
    paused_sub.status = SubscriptionStatus.paused
    paused_sub.paused_at = datetime(2024, 3, 1, tzinfo=UTC)
    await save_fixture(paused_sub)

    # Control: a genuinely canceled subscription, ended within the queried
    # window, so the churn metric is proven to fire (not vacuously zero).
    canceled_customer = await create_customer(
        save_fixture, organization=organization, email="canceled@example.com"
    )
    canceled_sub = await create_active_subscription(
        save_fixture,
        product=product,
        customer=canceled_customer,
        started_at=started_at,
    )
    canceled_sub.status = SubscriptionStatus.canceled
    canceled_sub.canceled_at = datetime(2024, 4, 10, tzinfo=UTC)
    canceled_sub.ended_at = datetime(2024, 4, 15, tzinfo=UTC)
    await save_fixture(canceled_sub)

    auth_subject: AuthSubject[User] = AuthSubject(user, {Scope.metrics_read}, None)

    metrics = await metrics_service.get_metrics(
        session,
        auth_subject,
        start_date=date(2024, 4, 1),
        end_date=date(2024, 4, 30),
        timezone=ZoneInfo("UTC"),
        interval=TimeInterval.month,
        organization_id=[organization.id],
        metrics=SQL_METRICS,
        now=datetime(2024, 4, 30, tzinfo=UTC),
    )

    period = metrics.periods[0]

    expected_mrr = active_sub.net_amount + paused_sub.net_amount

    # Paused subscription is counted exactly once alongside the active one;
    # the canceled control ended before this window and drops out.
    assert period.active_subscriptions == 2
    # Its recurring amount is included in MRR.
    assert period.monthly_recurring_revenue == expected_mrr
    # Only the canceled control counts as churn — pause does not.
    assert period.churned_subscriptions == 1
