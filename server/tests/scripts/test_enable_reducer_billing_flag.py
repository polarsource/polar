import uuid
from decimal import Decimal

import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import User
from scripts.enable_reducer_billing_flag import enable_statement
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_active_subscription,
    create_canceled_subscription,
    create_customer,
    create_meter,
    create_organization,
    create_product,
)


@pytest.mark.anyio
async def test_enables_flag_only_without_running_metered_subscriptions(
    session: AsyncSession, save_fixture: SaveFixture, user: User
) -> None:
    organizations = {
        name: await create_organization(
            save_fixture,
            await create_account(save_fixture, user),
            feature_settings=feature_settings,
        )
        for name, feature_settings in {
            "metered_product_only": {},
            "fixed_subscription": {
                "reducer_billing_enabled": False,
                "checkout_localization_enabled": True,
            },
            "ended_metered_subscription": {},
            "already_enabled": {"reducer_billing_enabled": True},
            "running_metered_subscription": {},
        }.items()
    }
    metered_products = {
        name: await create_product(
            save_fixture,
            organization=organizations[name],
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                (
                    await create_meter(
                        save_fixture, organization=organizations[name], id=uuid.uuid4()
                    ),
                    Decimal(100),
                    None,
                    "usd",
                )
            ],
            is_archived=name == "running_metered_subscription",
        )
        for name in (
            "metered_product_only",
            "ended_metered_subscription",
            "running_metered_subscription",
        )
    }
    await create_active_subscription(
        save_fixture,
        product=await create_product(
            save_fixture,
            organization=organizations["fixed_subscription"],
            recurring_interval=SubscriptionRecurringInterval.month,
        ),
        customer=await create_customer(
            save_fixture, organization=organizations["fixed_subscription"]
        ),
    )
    await create_canceled_subscription(
        save_fixture,
        product=metered_products["ended_metered_subscription"],
        customer=await create_customer(
            save_fixture, organization=organizations["ended_metered_subscription"]
        ),
        revoke=True,
    )
    await create_active_subscription(
        save_fixture,
        product=metered_products["running_metered_subscription"],
        customer=await create_customer(
            save_fixture, organization=organizations["running_metered_subscription"]
        ),
    )

    updated = await run_batched_update(
        enable_statement(), batch_size=1, sleep_seconds=0, session=session
    )

    assert updated == 3
    for organization in organizations.values():
        await session.refresh(organization)
    assert {
        name: organization.feature_settings.get("reducer_billing_enabled")
        for name, organization in organizations.items()
    } == {
        "metered_product_only": True,
        "fixed_subscription": True,
        "ended_metered_subscription": True,
        "already_enabled": True,
        "running_metered_subscription": None,
    }
    assert (
        organizations["fixed_subscription"].feature_settings[
            "checkout_localization_enabled"
        ]
        is True
    )
