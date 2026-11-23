import pytest

from polar.enums import SubscriptionProrationBehavior
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization
from polar.models.organization import OrganizationSubscriptionSettings
from scripts.backfill_trial_ended_reactivation_period import backfill_statement
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture


@pytest.mark.anyio
async def test_backfills_missing_key_and_keeps_existing_value(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    organization_second: Organization,
) -> None:
    legacy_settings: OrganizationSubscriptionSettings = {
        "allow_multiple_subscriptions": True,
        "allow_customer_updates": True,
        "proration_behavior": SubscriptionProrationBehavior.invoice,
        "benefit_revocation_grace_period": 7,
        "prevent_trial_abuse": False,
    }
    organization.subscription_settings = legacy_settings
    organization_second.subscription_settings = {
        **legacy_settings,
        "trial_ended_reactivation_period": 0,
    }
    for org in (organization, organization_second):
        await save_fixture(org)
        await session.refresh(org)
    modified_at = {
        org.id: org.modified_at for org in (organization, organization_second)
    }

    updated = await run_batched_update(
        backfill_statement(), batch_size=1, sleep_seconds=0, session=session
    )

    assert updated == 1
    for org in (organization, organization_second):
        await session.refresh(org)
        assert org.modified_at == modified_at[org.id]
    assert organization.subscription_settings == {
        **legacy_settings,
        "trial_ended_reactivation_period": 14,
    }
    assert (
        organization_second.subscription_settings["trial_ended_reactivation_period"]
        == 0
    )
