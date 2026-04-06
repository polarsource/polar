"""
Integration test: One-time product purchase flow.
"""

import pytest
from sqlalchemy.orm import joinedload

from polar.checkout.service import checkout as checkout_service
from polar.invoice.generator import Invoice
from polar.kit.address import Address, CountryAlpha2
from polar.kit.db.postgres import AsyncSession
from polar.models import Order
from polar.models.benefit import BenefitType
from polar.models.checkout import CheckoutStatus
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.order.repository import OrderRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_checkout,
    create_customer,
    create_organization,
    create_product,
    set_product_benefits,
)

from .conftest import drain_jobs, get_benefit_grants


@pytest.mark.asyncio
async def test_one_time_purchase(
    save_fixture: SaveFixture,
    session: AsyncSession,
) -> None:
    # Story:
    #     An organization sells a $25 one-time product ("Pro Toolkit") with a
    #     Custom benefit attached. A customer checks out, pays, and we verify
    #     the entire chain: order creation, benefit granting, and invoice.

    organization = await create_organization(save_fixture)

    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        prices=[(2500, "usd")],
        name="Pro Toolkit",
    )

    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.custom,
        description="Access to Pro resources",
    )
    product = await set_product_benefits(
        save_fixture, product=product, benefits=[benefit]
    )

    customer = await create_customer(
        save_fixture,
        organization=organization,
        email="buyer@example.com",
        name="Jane Buyer",
        billing_address=Address(
            country=CountryAlpha2("US"),
            line1="123 Main St",
            city="New York",
            state="NY",
            postal_code="10001",
        ),
    )

    checkout = await create_checkout(
        save_fixture,
        products=[product],
        status=CheckoutStatus.confirmed,
        customer=customer,
    )

    checkout = await checkout_service.handle_success(session, checkout)

    assert checkout.status == CheckoutStatus.succeeded

    order_repository = OrderRepository.from_session(session)
    order = await order_repository.get_earliest_by_checkout_id(
        checkout.id,
        options=(joinedload(Order.items),),
    )
    assert order is not None

    assert order.status == OrderStatus.paid
    assert order.subtotal_amount == 2500
    assert order.currency == "usd"
    assert order.billing_reason == OrderBillingReasonInternal.purchase
    assert order.product_id == product.id
    assert order.customer_id == customer.id
    assert order.subscription_id is None
    assert order.invoice_number is not None

    assert len(order.items) == 1
    item = order.items[0]
    assert item.label == "Pro Toolkit"
    assert item.amount == 2500
    assert item.proration is False

    await drain_jobs(session)

    grants = await get_benefit_grants(session, customer.id, benefit.id)

    assert len(grants) == 1
    assert grants[0].is_granted is True

    invoice = Invoice.from_order(order)

    assert invoice.number == order.invoice_number
    assert invoice.subtotal_amount == 2500
    assert invoice.currency == "usd"
    assert invoice.customer_name == "Jane Buyer"

    assert len(invoice.items) == 1
    assert invoice.items[0].description == "Pro Toolkit"
    assert invoice.items[0].amount == 2500
