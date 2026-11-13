"""
E2E: Subscription purchase — trial without a payment method.

A product with `trial_payment_setup_required=False` lets the customer start a
trial without a card or billing address. The confirm skips Stripe intents and
handle_free_success creates a trialing subscription with no payment method.
"""

import uuid

import pytest
from httpx import AsyncClient

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.trial import TrialInterval
from polar.models import Organization, Product
from polar.models.subscription import SubscriptionStatus
from polar.subscription.repository import SubscriptionRepository
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn
from tests.e2e.purchase.conftest import BUYER_EMAIL, BUYER_NAME
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest.fixture
async def cardless_trial_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        name="E2E Cardless Trial Plan",
        prices=[(1500, "usd")],
        trial_interval=TrialInterval.day,
        trial_interval_count=14,
        trial_payment_setup_required=False,
    )


@pytest.mark.anyio
class TestSubscriptionTrialWithoutPaymentMethod:
    @E2E_AUTH
    async def test_full_flow(
        self,
        client: AsyncClient,
        session: AsyncSession,
        drain: DrainFn,
        cardless_trial_product: Product,
    ) -> None:
        response = await client.post(
            "/v1/checkouts/", json={"products": [str(cardless_trial_product.id)]}
        )
        assert response.status_code == 201, response.text
        checkout = response.json()
        assert checkout["trial_end"] is not None
        assert checkout["is_payment_form_required"] is False
        assert checkout["is_payment_setup_required"] is False
        await drain()

        response = await client.post(
            f"/v1/checkouts/client/{checkout['client_secret']}/confirm",
            json={"customer_email": BUYER_EMAIL, "customer_name": BUYER_NAME},
        )
        assert response.status_code == 200, response.text
        await drain()

        response = await client.get(f"/v1/checkouts/{checkout['id']}")
        assert response.status_code == 200
        assert response.json()["status"] == "succeeded"

        response = await client.get("/v1/subscriptions/")
        assert response.status_code == 200
        subscriptions = response.json()
        assert subscriptions["pagination"]["total_count"] == 1
        subscription_id = uuid.UUID(subscriptions["items"][0]["id"])

        subscription = await SubscriptionRepository.from_session(session).get_by_id(
            subscription_id
        )
        assert subscription is not None
        assert subscription.status == SubscriptionStatus.trialing
        assert subscription.trial_end is not None
        assert subscription.payment_method_id is None
