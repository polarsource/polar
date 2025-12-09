import inspect
import os

import pytest

from polar.models.order import OrderBillingReasonInternal
from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
    NotificationPayloadBase,
)


async def check_diff(email: tuple[str, str]) -> None:
    (subject, body) = email
    expected = f"{subject}\n<hr>\n{body}"

    # Run with `POLAR_TEST_RECORD=1 pytest` to produce new golden files :-)
    record = os.environ.get("POLAR_TEST_RECORD", False) == "1"

    name = inspect.stack()[1].function

    if record:
        with open(f"./tests/notifications/testdata/{name}.html", "w") as f:
            f.write(expected)
            return
    else:
        with open(f"./tests/notifications/testdata/{name}.html") as f:
            content = f.read()

    assert content == expected


@pytest.mark.asyncio
async def test_MaintainerNewPaidSubscriptionNotification() -> None:
    n = MaintainerNewPaidSubscriptionNotificationPayload(
        subscriber_name="John Doe",
        tier_name="My Paid Tier",
        tier_price_amount=500,
        tier_organization_name="myorg",
        tier_price_recurring_interval="month",
    )

    await check_diff(n.render())


@pytest.mark.asyncio
async def test_MaintainerNewProductSaleNotification() -> None:
    n = MaintainerNewProductSaleNotificationPayload(
        customer_email="birk@polar.sh",
        customer_name="Birk",
        billing_address_country="US",
        billing_address_city="San Francisco",
        billing_address_line1="123 Main St",
        product_name="My Awesome Digital Product",
        product_price_amount=500,
        product_image_url=None,
        order_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        order_date="2024-11-05T20:41:00Z",
        organization_name="myorg",
        organization_slug="myorg",
        billing_reason=OrderBillingReasonInternal.purchase,
    )

    await check_diff(n.render())


@pytest.mark.asyncio
async def test_MaintainerCreateAccountNotificationPayload() -> None:
    n = MaintainerCreateAccountNotificationPayload(
        organization_name="orgname",
        url="https://example.com/url",
    )

    await check_diff(n.render())


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        MaintainerNewProductSaleNotificationPayload(
            customer_email="{{ 123456 * 9 }}",
            customer_name="{{ 123456 * 9 }}",
            product_name="{{ 123456 * 9 }}",
            product_price_amount=500,
            order_id="{{ 123456 * 9 }}",
            order_date="2024-11-05T20:41:00Z",
            organization_name="{{ 123456 * 9 }}",
            organization_slug="{{ 123456 * 9 }}",
            billing_reason=OrderBillingReasonInternal.purchase,
        ),
        MaintainerCreateAccountNotificationPayload(
            organization_name="{{ 123456 * 9 }}",
            url="https://example.com/url",
        ),
        MaintainerNewPaidSubscriptionNotificationPayload(
            subscriber_name="John Doe",
            tier_name="{{ 123456 * 9 }}",
            tier_price_amount=500,
            tier_organization_name="{{ 123456 * 9 }}",
            tier_price_recurring_interval="month",
        ),
    ],
)
async def test_injection_payloads(payload: NotificationPayloadBase) -> None:
    subject, body = payload.render()
    assert str(123456 * 9) not in subject
    assert str(123456 * 9) not in body

    assert "{{ 123456 * 9 }}" in body


@pytest.mark.asyncio
async def test_MaintainerNewProductSaleNotification_backwards_compatibility() -> None:
    old_notification_data = {
        "product_name": "Old Product",
        "product_price_amount": 1000,
    }

    n = MaintainerNewProductSaleNotificationPayload.model_validate(
        old_notification_data
    )

    assert n.product_name == "Old Product"
    assert n.product_price_amount == 1000
    assert n.customer_name == ""
    assert n.organization_name == ""
    assert n.customer_email is None
    assert n.order_id is None
    assert n.order_date is None
    assert n.billing_reason is None

    subject, body = n.render()
    assert "Old Product" in body
    assert "$10.00" in subject
