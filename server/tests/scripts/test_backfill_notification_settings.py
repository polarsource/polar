import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, UserOrganization
from scripts.backfill_notification_settings import backfill_statement
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


@pytest.mark.asyncio
async def test_backfills_missing_keys_and_keeps_existing_values(
    session: AsyncSession, save_fixture: SaveFixture, organization: Organization
) -> None:
    subscriptions_off = UserOrganization(
        user=await create_user(save_fixture),
        organization=organization,
        notification_settings={
            "new_order": True,
            "new_subscription": False,
            "chargeback_prevention": True,
            "subscription_renewal": True,
        },
    )
    subscriptions_on = UserOrganization(
        user=await create_user(save_fixture),
        organization=organization,
        notification_settings={
            "new_order": False,
            "new_subscription": True,
            "chargeback_prevention": True,
            "subscription_renewal": False,
        },
    )
    already_set = UserOrganization(
        user=await create_user(save_fixture),
        organization=organization,
        notification_settings={
            "new_order": True,
            "new_subscription": True,
            "new_trial": False,
            "chargeback_prevention": True,
            "subscription_renewal": False,
            "subscription_cancellation": False,
            "exclude_free_products": True,
        },
    )
    for user_organization in (subscriptions_off, subscriptions_on, already_set):
        await save_fixture(user_organization)

    modified_at = {
        uo.user_id: uo.modified_at
        for uo in (subscriptions_off, subscriptions_on, already_set)
    }

    updated = await run_batched_update(
        backfill_statement(), batch_size=1, sleep_seconds=0, session=session
    )

    assert updated == 2
    for user_organization in (subscriptions_off, subscriptions_on, already_set):
        await session.refresh(user_organization)
    assert subscriptions_off.notification_settings == {
        "new_order": True,
        "new_subscription": False,
        "new_trial": False,
        "chargeback_prevention": True,
        "subscription_renewal": True,
        "subscription_cancellation": False,
        "exclude_free_products": False,
    }
    assert subscriptions_on.notification_settings["new_trial"] is True
    assert subscriptions_on.notification_settings["subscription_cancellation"] is False
    assert subscriptions_on.notification_settings["exclude_free_products"] is False
    assert already_set.notification_settings["new_trial"] is False
    assert already_set.notification_settings["subscription_cancellation"] is False
    assert already_set.notification_settings["exclude_free_products"] is True
    for user_organization in (subscriptions_off, subscriptions_on, already_set):
        assert user_organization.modified_at == modified_at[user_organization.user_id]
