import inspect
import os
import re

import pytest

from polar.notifications.notification import (
    MaintainerAccountReviewedNotificationPayload,
    MaintainerAccountUnderReviewNotificationPayload,
    MaintainerCreateAccountNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
    NotificationPayload,
    NotificationPayloadBase,
    NotificationType,
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
        customer_name="birk@polar.sh",
        product_name="My Awesome Digital Product",
        product_price_amount=500,
        organization_name="myorg",
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
            customer_name="{{ 123456 * 9 }}",
            product_name="{{ 123456 * 9 }}",
            product_price_amount=500,
            organization_name="{{ 123456 * 9 }}",
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
async def test_all_notification_types() -> None:
    n: NotificationPayload
    for notification_type in NotificationType:
        if notification_type == NotificationType.maintainer_create_account:
            n = MaintainerCreateAccountNotificationPayload(
                organization_name="John Doe",
                url="https://example.com/url",
            )
        elif notification_type == NotificationType.maintainer_account_under_review:
            n = MaintainerAccountUnderReviewNotificationPayload(
                account_type="Stripe Connect Express",
            )
        elif notification_type == NotificationType.maintainer_account_reviewed:
            n = MaintainerAccountReviewedNotificationPayload(
                account_type="Stripe Connect Express",
            )
        elif notification_type == NotificationType.maintainer_new_product_sale:
            n = MaintainerNewProductSaleNotificationPayload(
                customer_name="John Doe",
                product_name="Ice cream sandwich",
                product_price_amount=500,
                organization_name="Ice Cream Van",
            )
        elif notification_type == NotificationType.maintainer_new_paid_subscription:
            n = MaintainerNewPaidSubscriptionNotificationPayload(
                subscriber_name="John Doe",
                tier_name="ColdMail Premium",
                tier_price_amount=500,
                tier_organization_name="ColdMail",
                tier_price_recurring_interval="month",
            )
        else:
            raise TypeError(f"Missing test case for {notification_type}")

    # Check that it renders!
    subject, body = n.render()

    # Check that there are no leftover placeholders
    assert re.search(r"{ ?[^\s}]+ ?}", subject) is None
    assert re.search(r"{ ?[^\s}]+ ?}", body) is None
