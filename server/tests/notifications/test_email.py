import asyncio
import inspect
import os
from datetime import UTC, datetime
from pathlib import Path

import pytest

from polar.email.react import render_email_template
from polar.models.order import OrderBillingReasonInternal
from polar.models.subscription import CustomerCancellationReason
from polar.notifications.notification import (
    MaintainerAccountCreditsGrantedNotificationPayload,
    MaintainerFileFlaggedMaliciousNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
    MaintainerNewTrialNotificationPayload,
    MaintainerSubscriptionCancellationNotificationPayload,
    NotificationPayloadBase,
)


async def check_diff(notification: NotificationPayloadBase) -> None:
    subject = notification.subject()
    body = await render_email_template(notification.to_email())
    expected = f"{subject}\n<hr>\n{body}"

    # Run with `POLAR_TEST_RECORD=1 pytest` to produce new golden files :-)
    record = os.environ.get("POLAR_TEST_RECORD") == "1"

    name = inspect.stack()[1].function
    testdata_path = Path(f"./tests/notifications/testdata/{name}.html")

    if record:
        await asyncio.to_thread(testdata_path.write_text, expected, encoding="utf-8")
        return
    else:
        content = await asyncio.to_thread(testdata_path.read_text, encoding="utf-8")

    assert content == expected


@pytest.mark.asyncio
async def test_MaintainerNewPaidSubscriptionNotification() -> None:
    n = MaintainerNewPaidSubscriptionNotificationPayload(
        subscriber_name="John Doe",
        tier_name="My Paid Tier",
        tier_price_amount=500,
        tier_organization_name="myorg",
        tier_organization_slug="myorg",
        tier_price_recurring_interval="month",
        subscription_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    )

    await check_diff(n)


@pytest.mark.asyncio
async def test_MaintainerNewPaidSubscriptionNotification_every_6_months() -> None:
    n = MaintainerNewPaidSubscriptionNotificationPayload(
        subscriber_name="John Doe",
        tier_name="My Paid Tier",
        tier_price_amount=5000,
        tier_organization_name="myorg",
        tier_organization_slug="myorg",
        tier_price_recurring_interval="month",
        tier_price_recurring_interval_count=6,
        subscription_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    )

    await check_diff(n)


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

    await check_diff(n)


@pytest.mark.asyncio
async def test_MaintainerAccountCreditsGrantedNotification() -> None:
    n = MaintainerAccountCreditsGrantedNotificationPayload(
        organization_name="Test Org",
        amount=5000,
    )

    await check_diff(n)


@pytest.mark.asyncio
async def test_MaintainerNewTrialNotification() -> None:
    n = MaintainerNewTrialNotificationPayload(
        subscriber_name="John Doe",
        subscriber_email="john.doe@example.com",
        product_name="Pro",
        organization_name="Test Org",
        organization_slug="test-org",
        subscription_id="7e4b1c3a-0f5d-4d2e-9b8a-1c2d3e4f5a6b",
        trial_end=datetime(2026, 10, 12, tzinfo=UTC),
    )

    await check_diff(n)


@pytest.mark.asyncio
async def test_MaintainerSubscriptionCancellationNotification() -> None:
    n = MaintainerSubscriptionCancellationNotificationPayload(
        subscriber_name="John Doe",
        subscriber_email="john.doe@example.com",
        product_name="Pro",
        organization_name="Test Org",
        organization_slug="test-org",
        subscription_id="7e4b1c3a-0f5d-4d2e-9b8a-1c2d3e4f5a6b",
        cancellation_reason=CustomerCancellationReason.too_expensive,
        cancellation_comment="We are cutting costs this quarter.",
        cancel_at_period_end=True,
        ends_at=datetime(2026, 10, 12, tzinfo=UTC),
    )

    await check_diff(n)


@pytest.mark.asyncio
async def test_MaintainerSubscriptionCancellationNotification_immediately() -> None:
    n = MaintainerSubscriptionCancellationNotificationPayload(
        subscriber_name="John Doe",
        subscriber_email=None,
        product_name="Pro",
        organization_name="Test Org",
        organization_slug="test-org",
        subscription_id="7e4b1c3a-0f5d-4d2e-9b8a-1c2d3e4f5a6b",
        cancellation_reason=None,
        cancellation_comment=None,
        cancel_at_period_end=False,
        ends_at=datetime(2026, 9, 30, tzinfo=UTC),
    )

    await check_diff(n)


@pytest.mark.asyncio
async def test_MaintainerFileFlaggedMaliciousNotification() -> None:
    n = MaintainerFileFlaggedMaliciousNotificationPayload(
        file_name="whitepaper.pdf",
        organization_name="Test Org",
        organization_slug="test-org",
    )

    await check_diff(n)


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
        MaintainerNewPaidSubscriptionNotificationPayload(
            subscriber_name="John Doe",
            tier_name="{{ 123456 * 9 }}",
            tier_price_amount=500,
            tier_organization_name="{{ 123456 * 9 }}",
            tier_organization_slug="{{ 123456 * 9 }}",
            tier_price_recurring_interval="month",
            subscription_id="{{ 123456 * 9 }}",
        ),
        MaintainerNewTrialNotificationPayload(
            subscriber_name="{{ 123456 * 9 }}",
            subscriber_email=None,
            product_name="{{ 123456 * 9 }}",
            organization_name="{{ 123456 * 9 }}",
            organization_slug="{{ 123456 * 9 }}",
            subscription_id="{{ 123456 * 9 }}",
            trial_end=None,
        ),
        MaintainerSubscriptionCancellationNotificationPayload(
            subscriber_name="{{ 123456 * 9 }}",
            subscriber_email="{{ 123456 * 9 }}",
            product_name="{{ 123456 * 9 }}",
            organization_name="{{ 123456 * 9 }}",
            organization_slug="{{ 123456 * 9 }}",
            subscription_id="{{ 123456 * 9 }}",
            cancellation_reason=CustomerCancellationReason.other,
            cancellation_comment="{{ 123456 * 9 }}",
            cancel_at_period_end=True,
            ends_at=None,
        ),
        MaintainerAccountCreditsGrantedNotificationPayload(
            organization_name="{{ 123456 * 9 }}",
            amount=5000,
        ),
        MaintainerFileFlaggedMaliciousNotificationPayload(
            file_name="{{ 123456 * 9 }}",
            organization_name="{{ 123456 * 9 }}",
            organization_slug="{{ 123456 * 9 }}",
        ),
    ],
)
async def test_injection_payloads(payload: NotificationPayloadBase) -> None:
    subject = payload.subject()
    body = await render_email_template(payload.to_email())
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

    subject = n.subject()
    body = await render_email_template(n.to_email())
    assert "Old Product" in body
    assert "$10.00" in subject
