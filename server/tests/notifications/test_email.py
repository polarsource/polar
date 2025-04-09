import inspect
import os

import pytest

from polar.kit import template
from polar.kit.utils import utc_now
from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
)


async def check_diff(email: tuple[str, str]) -> None:
    (subject, body) = email
    expected = f"{subject}\n<hr>\n{body}"

    # Run with `POLAR_TEST_RECORD=1 pytest` to produce new golden files :-)
    record = os.environ.get("POLAR_TEST_RECORD", False) == "1"

    name = inspect.stack()[1].function

    if record:
        with open(f"./tests/notifications/testdata/{name}.html", "w+") as f:
            f.write(expected)
            return

    content = template.render(
        template.path(__file__, f"testdata/{name}.html"),
        year=str(utc_now().year),
    )
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
