"""Test for order schema serialization."""

import pytest

from polar.models.customer import Customer
from polar.models.order import (
    OrderBillingReason,
    OrderBillingReasonInternal,
)
from polar.models.product import Product
from polar.order.schemas import Order
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order

# Mapping of all internal billing reasons to their expected serialized output
BILLING_REASON_SERIALIZATION_MAP = {
    OrderBillingReasonInternal.purchase: OrderBillingReason.purchase,
    OrderBillingReasonInternal.subscription_create: OrderBillingReason.subscription_create,
    OrderBillingReasonInternal.subscription_cycle: OrderBillingReason.subscription_cycle,
    OrderBillingReasonInternal.subscription_cycle_after_trial: OrderBillingReason.subscription_cycle,
    OrderBillingReasonInternal.subscription_update: OrderBillingReason.subscription_update,
}

# Ensure the mapping is exhaustive for all internal billing reasons
assert set(BILLING_REASON_SERIALIZATION_MAP.keys()) == set(
    OrderBillingReasonInternal
), "BILLING_REASON_SERIALIZATION_MAP must cover all OrderBillingReasonInternal values"


@pytest.mark.asyncio
class TestOrderBillingReasonSerializer:
    """Test OrderBase billing_reason field serializer."""

    @pytest.mark.parametrize(
        ("internal_reason", "expected_output"),
        list(BILLING_REASON_SERIALIZATION_MAP.items()),
    )
    # We ignore the DeprecationWarning that is logged by model_dump, since we're not
    # looking at the deprecated fields in this test.
    @pytest.mark.filterwarnings("ignore::DeprecationWarning")
    async def test_billing_reason_serialization(
        self,
        internal_reason: OrderBillingReasonInternal,
        expected_output: OrderBillingReason,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_reason=internal_reason,
        )

        order_schema = Order.model_validate(order)
        serialized = order_schema.model_dump(mode="json")
        assert serialized["billing_reason"] == expected_output
