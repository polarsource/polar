"""
E2E: Lifecycle — trial subscription with metered pricing, canceled mid-trial.

**Invariant:** Polar must never charge a customer during a trial. Neither
static recurring prices nor metered usage should produce a Stripe charge
before the trial converts to ``active``.

Flow exercised end-to-end:

1. ``POST /v1/checkouts/`` on a metered product with a trial interval.
2. ``POST /v1/checkouts/client/{secret}/confirm`` → Stripe ``SetupIntent``
   (no charge yet — trial).
3. ``setup_intent.succeeded`` webhook → trialing subscription created.
4. ``PATCH /v1/subscriptions/{id}`` with ``cancel_at_period_end=true``.
5. ``POST /v1/events/ingest`` with N events matching the meter, then the
   ``meter.billing_entries`` task runs → pending
   ``BillingEntryType.metered`` rows for the trial period.
6. At ``trial_end`` the scheduler fires ``subscription.cycle`` via the
   real ``SubscriptionJobStore`` query.

The test asserts that **no Stripe charge is initiated** and **no billable
``subscription_cancel`` order is created**. The test currently FAILS — the
revoke branch of ``cycle()`` unconditionally enqueues
``order.create_subscription_order`` with ``billing_reason=subscription_cancel``,
which pulls the pending metered entries and bills them.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import freezegun
import pytest
import pytest_asyncio
import stripe as stripe_lib
from httpx import AsyncClient
from sqlalchemy import select

from polar.auth.scope import Scope
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.trial import TrialInterval
from polar.models import Meter, Order, Organization, Product
from polar.subscription.repository import SubscriptionRepository
from polar.worker import JobQueueManager
from tests.e2e.infra import DrainFn, SchedulerSimulator, StripeSimulator
from tests.e2e.infra.stripe_simulator import simulate_webhook
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_meter,
    create_product,
)

TRIAL_START = datetime(2026, 4, 8, 12, 0, 0, tzinfo=UTC)
TRIAL_END = datetime(2026, 4, 15, 12, 0, 0, tzinfo=UTC)

UNIT_AMOUNT_CENTS = 2900  # $29 per metered unit
USAGE_UNITS = 4

# Needs `events:write` on top of the normal E2E scopes to call /v1/events/ingest.
_TRIAL_METERED_AUTH = pytest.mark.auth(
    AuthSubjectFixture(
        subject="user",
        scopes={
            Scope.checkouts_read,
            Scope.checkouts_write,
            Scope.orders_read,
            Scope.subscriptions_read,
            Scope.subscriptions_write,
            Scope.events_write,
        },
    )
)


@pytest_asyncio.fixture
async def trial_metered_product(
    save_fixture: SaveFixture,
    organization: Organization,
) -> tuple[Product, Meter]:
    """Metered product with a 1-week trial."""
    meter = await create_meter(save_fixture, organization=organization)
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        trial_interval=TrialInterval.week,
        trial_interval_count=1,
        prices=[(meter, Decimal(UNIT_AMOUNT_CENTS), None, "usd")],
        name="Metered Trial Plan",
        is_tax_applicable=False,
    )
    return product, meter


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

    # 2. Confirm — trial + metered ⇒ SetupIntent (no charge)
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

    # 3. Fire setup_intent.succeeded → handle_success → subscription created
    setup_intent_mock = stripe_sim.mock.create_setup_intent.return_value
    setup_intent = stripe_lib.SetupIntent.construct_from(
        {
            "id": setup_intent_mock.id,
            "object": "setup_intent",
            "client_secret": setup_intent_mock.client_secret,
            "status": "succeeded",
            "customer": stripe_sim.customer_id,
            "payment_method": "pm_e2e_trial",
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
class TestTrialMeteredCancel:
    @_TRIAL_METERED_AUTH
    async def test_canceling_metered_trial_does_not_charge_customer(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        save_fixture: SaveFixture,
        trial_metered_product: tuple[Product, Meter],
    ) -> None:
        product, meter = trial_metered_product

        # ── Trial purchase + mid-trial cancel via API ──
        with freezegun.freeze_time(TRIAL_START):
            subscription_id = await _complete_trial_checkout(
                client, session, stripe_sim, drain, organization, product
            )

            response = await client.patch(
                f"/v1/subscriptions/{subscription_id}",
                json={"cancel_at_period_end": True},
            )
            assert response.status_code == 200, response.text
            sub_data = response.json()
            assert sub_data["status"] == "trialing"
            assert sub_data["cancel_at_period_end"] is True
            customer_id = sub_data["customer_id"]
            await drain(ignored_actors={"email.send"})

            # ── Ingest metered usage via the public API ──
            # Each event matches the meter (filter: name == METER_TEST_EVENT,
            # aggregation: count), so USAGE_UNITS events produce USAGE_UNITS
            # billable units after `meter.billing_entries` runs.
            response = await client.post(
                "/v1/events/ingest",
                json={
                    "events": [
                        {
                            "name": METER_TEST_EVENT,
                            "customer_id": customer_id,
                            "organization_id": str(organization.id),
                        }
                        for _ in range(USAGE_UNITS)
                    ]
                },
            )
            assert response.status_code == 200, response.text
            assert response.json()["inserted"] == USAGE_UNITS
            await drain(ignored_actors={"email.send"})

            # The `meter.billing_entries` cron runs every 15 min in prod —
            # trigger it directly here so pending MeterEvents become
            # `BillingEntryType.metered` rows before the trial-end cycle.
            JobQueueManager.set()
            jqm = JobQueueManager.get()
            jqm.enqueue_job("meter.billing_entries", meter.id)
            await session.flush()
            await drain(ignored_actors={"email.send"})

        # ── Trial end: scheduler fires `subscription.cycle` ──
        with freezegun.freeze_time(TRIAL_END):
            assert await scheduler_sim.get_due_count() == 1, (
                "Expected the trialing subscription to be due at trial_end"
            )

            # `email.send` relies on a native binary unavailable in some dev
            # environments; skip it — the payment path is what we care about.
            async def _drain(**_kwargs: object) -> object:
                return await drain(ignored_actors={"email.send"})

            await scheduler_sim.trigger_due_cycles(_drain)  # type: ignore[arg-type]

        # ── Invariant: trial cancellation must not charge the customer ──
        create_payment_intent = stripe_sim.mock.create_payment_intent
        assert not create_payment_intent.called, (
            "Polar tried to charge the customer during a trial. "
            f"`stripe_service.create_payment_intent` was called "
            f"{create_payment_intent.call_count} time(s) for "
            f"{USAGE_UNITS} units of metered trial usage. Trial usage "
            "should never be billed — on cancellation it must be dropped."
        )

        # And no billable `subscription_cancel` order may exist.
        billable_cancel_orders = (
            (
                await session.execute(
                    select(Order).where(
                        Order.subscription_id == uuid.UUID(subscription_id),
                        Order.billing_reason == "subscription_cancel",
                        Order.net_amount > 0,
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(billable_cancel_orders) == 0, (
            f"Expected no billable subscription_cancel order, got "
            f"{len(billable_cancel_orders)} "
            f"(amounts: {[o.net_amount for o in billable_cancel_orders]})."
        )
