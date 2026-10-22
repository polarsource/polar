import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import User
from scripts.enable_meter_cycling_flag import enable_statement
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account, create_organization


@pytest.mark.anyio
async def test_enables_flag_and_keeps_other_settings(
    session: AsyncSession, save_fixture: SaveFixture, user: User
) -> None:
    organizations = [
        await create_organization(
            save_fixture,
            await create_account(save_fixture, user),
            feature_settings=feature_settings,
        )
        for feature_settings in (
            {},
            {"meter_cycling_enabled": False, "checkout_localization_enabled": True},
            {"meter_cycling_enabled": True},
        )
    ]
    modified_at = {o.id: o.modified_at for o in organizations}

    updated = await run_batched_update(
        enable_statement(), batch_size=1, sleep_seconds=0, session=session
    )

    assert updated == 2
    for organization in organizations:
        await session.refresh(organization)
        assert organization.feature_settings["meter_cycling_enabled"] is True
        assert organization.modified_at == modified_at[organization.id]
    assert organizations[1].feature_settings["checkout_localization_enabled"] is True
