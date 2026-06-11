import uuid
from typing import Any, cast

import pytest
from sqlalchemy import CursorResult, select

from polar.kit.db.postgres import AsyncSession
from polar.kit.visibility import Visibility
from polar.models import Benefit, Organization
from polar.models.benefit import BenefitType
from scripts.backfill_benefit_visibility import update_statement
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


async def _visibility(
    session: AsyncSession, benefit_id: uuid.UUID
) -> Visibility | None:
    result = await session.execute(
        select(Benefit.visibility).where(Benefit.id == benefit_id)
    )
    return result.scalar_one()


@pytest.mark.asyncio
async def test_backfill_benefit_visibility(
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
) -> None:
    custom = await create_benefit(
        save_fixture, organization=organization, type=BenefitType.custom
    )
    feature_flag = await create_benefit(
        save_fixture, organization=organization, type=BenefitType.feature_flag
    )
    discord = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.discord,
        properties={"guild_id": "123", "role_id": "456", "kick_member": False},
    )
    already_set = await create_benefit(
        save_fixture, organization=organization, type=BenefitType.custom
    )
    already_set.visibility = Visibility.private
    await save_fixture(already_set)

    result = await session.execute(update_statement, {"limit": 1000})
    await session.commit()
    assert cast(CursorResult[Any], result).rowcount == 3

    assert await _visibility(session, custom.id) == Visibility.public
    assert await _visibility(session, feature_flag.id) == Visibility.public
    assert await _visibility(session, discord.id) == Visibility.public
    assert await _visibility(session, already_set.id) == Visibility.private

    result = await session.execute(update_statement, {"limit": 1000})
    await session.commit()
    assert cast(CursorResult[Any], result).rowcount == 0
