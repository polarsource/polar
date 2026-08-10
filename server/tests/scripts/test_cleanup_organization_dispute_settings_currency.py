from typing import cast

import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization
from polar.models.organization import OrganizationDisputeSettings
from scripts.cleanup_organization_dispute_settings_currency import (
    drop_key_statement,
    pending_count_statement,
)
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture


def _with_currency(amount: int | None) -> OrganizationDisputeSettings:
    """Settings as the first backfill wrote them, before the key was dropped."""
    return cast(
        OrganizationDisputeSettings,
        {"auto_accept_below_amount": amount, "auto_accept_currency": "usd"},
    )


async def _cleanup(session: AsyncSession, *, batch_size: int = 5000) -> int:
    return await run_batched_update(
        drop_key_statement(),
        batch_size=batch_size,
        sleep_seconds=0,
        session=session,
    )


@pytest.mark.asyncio
class TestCleanupDisputeSettingsCurrency:
    async def test_drops_only_the_currency_key(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.dispute_settings = _with_currency(2500)
        await save_fixture(organization)

        assert await _cleanup(session) == 1

        await session.refresh(organization)
        assert organization.dispute_settings == {"auto_accept_below_amount": 2500}

    async def test_batches_until_none_left(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        for org in (organization, organization_second):
            org.dispute_settings = _with_currency(None)
            await save_fixture(org)

        assert await _cleanup(session, batch_size=1) == 2
        assert await session.scalar(pending_count_statement()) == 0
        assert await _cleanup(session) == 0
