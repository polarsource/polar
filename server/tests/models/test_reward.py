from decimal import Decimal

import pytest

from polar.ext.sqlalchemy import sql
from polar.ext.sqlalchemy.types import GUID
from polar.models.reward import Reward
from polar.postgres import AsyncSession


@pytest.mark.anyio
@pytest.mark.parametrize(
    "test_amount",
    [("10.10"), ("10.120"), ("10.1230"), ("123456789.99"), ("123456789.123456789")],
)
async def test_reward(session: AsyncSession, test_amount: str) -> None:
    created = await Reward.create(
        session,
        issue_id=GUID.generate(),
        repository_id=GUID.generate(),
        organization_id=GUID.generate(),
        amount=Decimal(test_amount),
    )

    assert created.id is not None

    await session.commit()
    await session.refresh(created)

    got = await Reward.find(session, created.id)
    assert got is not None
    assert got.amount == Decimal(test_amount)
