import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, UserOrganization
from scripts.backfill_exclude_free_products_setting import backfill_statement
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


@pytest.mark.asyncio
async def test_backfills_missing_key_and_keeps_existing_values(
    session: AsyncSession, save_fixture: SaveFixture, organization: Organization
) -> None:
    missing = UserOrganization(
        user=await create_user(save_fixture),
        organization=organization,
        notification_settings={
            "new_order": False,
            "new_subscription": True,
            "chargeback_prevention": True,
            "subscription_renewal": True,
        },
    )
    opted_in = UserOrganization(
        user=await create_user(save_fixture),
        organization=organization,
        notification_settings={
            "new_order": True,
            "new_subscription": True,
            "chargeback_prevention": True,
            "subscription_renewal": False,
            "exclude_free_products": True,
        },
    )
    await save_fixture(missing)
    await save_fixture(opted_in)

    updated = await run_batched_update(
        backfill_statement(), batch_size=1, sleep_seconds=0, session=session
    )

    assert updated == 1
    await session.refresh(missing)
    await session.refresh(opted_in)
    assert missing.notification_settings == {
        "new_order": False,
        "new_subscription": True,
        "chargeback_prevention": True,
        "subscription_renewal": True,
        "exclude_free_products": False,
    }
    assert opted_in.notification_settings["exclude_free_products"] is True
