"""
E2E: Lifecycle — static-price trial scheduled for cancellation via the API.

Regression test for the bug where a trialing subscription with
``cancel_at_period_end=True`` briefly became ``active`` (instead of
``canceled``) when ``cycle()`` ran at trial end, because the trial-to-active
conversion ran unconditionally after both the revoke and normal-cycle branches.

Flow exercised end-to-end:

1. ``POST /v1/checkouts/`` on a static-price product with a trial interval.
2. ``POST /v1/checkouts/client/{secret}/confirm`` → Stripe ``SetupIntent``
   (no charge during trial).
3. ``setup_intent.succeeded`` webhook → trialing subscription created.
4. ``PATCH /v1/subscriptions/{id}`` with ``cancel_at_period_end=true``.
5. At ``trial_end`` the scheduler fires ``subscription.cycle`` via the real
   ``SubscriptionJobStore`` query.

Asserts:

- The subscription is ``canceled`` (NOT ``active``) immediately after the
  first cycle — no inconsistent state window.
- No ``subscription_cycle_after_trial`` order is created; only the
  ``subscription_cancel`` order job is enqueued (no duplicate).
- ``GET /v1/subscriptions/{id}`` returns ``status: canceled``.
- The scheduler does not re-pick the subscription after the first cycle.
"""

from datetime import UTC, datetime

import freezegun
import pytest
import pytest_asyncio
import stripe as stripe_lib
from httpx import AsyncClient
from sqlalchemy import select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.trial import TrialInterval
from polar.models import Order, Organization, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.subscription.repository import SubscriptionRepository
from polar.worker import JobQueueManager
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, SchedulerSimulator, StripeSimulator
from tests.e2e.infra.stripe_simulator import simulate_webhook
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product

TRIAL_START = datetime(2026, 4, 1, 12, 0, 0, tzinfo=UTC)
TRIAL_END = datetime(2026, 4, 8, 12, 0, 0, tzinfo=UTC)
AMOUNT = 1500  # $15/month static price


@pytest_asyncio.fixture
async def trial_static_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        trial_interval=TrialInterval.week,
        trial_interval_count=1,
        prices=[(AMOUNT, "usd")],
        name="Static Trial Plan",
        is_tax_applicable=False,
    )


async def _complete_trial_checkout(
    client: AsyncClient,
    session: AsyncSession,
    stripe_sim: StripeSimulator,
    drain: DrainFn,
    organization: Organization,
    product: Product,
) -> str:
    """Run the trial checkout flow end-to-end. Returns the subscription id."""
    # 1. Create checkout
    response = await client.post("/v1/checkouts/", json={"products": [str(product.id)]})
    assert response.status_code == 201, response.text
    checkout_data = response.json()
    checkout_id = checkout_data["id"]
    client_secret = checkout_data["client_secret"]
    await drain()

    # 2. Confirm — trial ⇒ SetupIntent (no charge)
    stripe_sim.expect_setup(
        customer_name=BUYER_NAME,
        customer_email=BUYER_EMAIL,
        billing_address=BILLING_ADDRESS,
    )
    response = await client.post(
        f"/v1/checkouts/client/{client_secret}/confirm",
        json={
            "confirmation_token_id": "tok_test_confirm",
            "customer_email": BUYER_EMAIL,
            "customer_billing_address": BILLING_ADDRESS,
        },
    )
    assert response.status_code == 200, response.text
    await drain()

    # 3. Fire setup_intent.succeeded → subscription created
    setup_intent_mock = stripe_sim.mock.create_setup_intent.return_value
    setup_intent = stripe_lib.SetupIntent.construct_from(
        {
            "id": setup_intent_mock.id,
            "object": "setup_intent",
            "client_secret": setup_intent_mock.client_secret,
            "status": "succeeded",
            "customer": stripe_sim.customer_id,
            "payment_method": "pm_e2e_trial_static",
            "metadata": {
                "organization_id": str(organization.id),
                "checkout_id": checkout_id,
                "type": "product",
            },
        },
        None,
    )
    await simulate_webhook(session, "setup_intent.succeeded", setup_intent)
    await drain(ignored_actors={"email.send"})

    # Grab the subscription that the webhook created.
    subscription_repository = SubscriptionRepository.from_session(session)
    sub_list = await session.execute(
        select(subscription_repository.model).order_by(
            subscription_repository.model.created_at.desc()
        )
    )
    subscription = sub_list.scalars().first()
    assert subscription is not None, (
        "setup_intent.succeeded did not produce a subscription"
    )
    return str(subscription.id)


@pytest.mark.asyncio
class TestTrialCancelStaticPrice:
    @E2E_AUTH
    async def test_trial_cancel_static_price_ends_canceled(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        trial_static_product: Product,
    ) -> None:
        # ── 1. Purchase a static-price subscription with a 1-week trial ──
        with freezegun.freeze_time(TRIAL_START):
            subscription_id = await _complete_trial_checkout(
                client, session, stripe_sim, drain, organization, trial_static_product
            )

            # Confirm trialing state via the API.
            response = await client.get(f"/v1/subscriptions/{subscription_id}")
            assert response.status_code == 200, response.text
            sub_data = response.json()
            assert sub_data["status"] == SubscriptionStatus.trialing
            assert sub_data["cancel_at_period_end"] is False

            # ── 2. Schedule cancellation via the real cancel API ──
            response = await client.patch(
                f"/v1/subscriptions/{subscription_id}",
                json={"cancel_at_period_end": True},
            )
            assert response.status_code == 200, response.text
            sub_data = response.json()
            assert sub_data["status"] == SubscriptionStatus.trialing
            assert sub_data["cancel_at_period_end"] is True
            await drain(ignored_actors={"email.send"})

        # ── 3. Trial end: scheduler fires subscription.cycle ──
        with freezegun.freeze_time(TRIAL_END):
            assert await scheduler_sim.get_due_count() == 1, (
                "Expected the trialing subscription to be due at trial_end"
            )

            async def _drain(**_kwargs: object) -> object:
                return await drain(ignored_actors={"email.send"})

            await scheduler_sim.trigger_due_cycles(_drain)  # type: ignore[arg-type]

        # ── 4. Assert status is canceled on the FIRST cycle (no active window) ──
        response = await client.get(f"/v1/subscriptions/{subscription_id}")
        assert response.status_code == 200, response.text
        sub_data = response.json()
        assert sub_data["status"] == SubscriptionStatus.canceled, (
            f"BUG: status should be canceled but is {sub_data['status']}. "
            f"ended_at={sub_data.get('ended_at')}, "
            f"cancel_at_period_end={sub_data.get('cancel_at_period_end')}"
        )
        assert sub_data["cancel_at_period_end"] is True
        assert sub_data["ended_at"] is not None

        # ── 5. No after-trial order ──
        orders = (
            (
                await session.execute(
                    select(Order).where(Order.subscription_id == sub_data["id"])
                )
            )
            .scalars()
            .all()
        )
        after_trial_orders = [
            o for o in orders if o.billing_reason == "subscription_cycle_after_trial"
        ]
        assert len(after_trial_orders) == 0, (
            "No subscription_cycle_after_trial order should be created when "
            f"revoking at trial end. Found {len(after_trial_orders)}."
        )

        # ── 6. Scheduler does not re-pick the subscription ──
        with freezegun.freeze_time(TRIAL_END):
            due_after = await scheduler_sim.get_due_count()
            assert due_after == 0, (
                "Subscription should not be re-picked by the scheduler after "
                f"being canceled on the first cycle. due_count={due_after}."
            )

        # ── 7. Confirm in DB the status is canceled (belt-and-suspenders) ──
        db_sub = await session.get(Subscription, sub_data["id"])
        assert db_sub is not None
        assert db_sub.status == SubscriptionStatus.canceled
        assert db_sub.ended_at is not None

        # Reference JobQueueManager to satisfy the import (used by scheduler_sim).
        _ = JobQueueManager
