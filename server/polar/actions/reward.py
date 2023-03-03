from __future__ import annotations

from typing import Sequence

import structlog

from polar.actions.base import Action
from polar.ext.sqlalchemy.types import GUID
from polar.models.reward import Reward
from polar.postgres import AsyncSession, sql
from polar.schema.reward import RewardCreate, RewardUpdate

log = structlog.get_logger()


class RewardActions(Action[Reward, RewardCreate, RewardUpdate]):
    async def list_by_repository(
        self, session: AsyncSession, repository_id: GUID
    ) -> Sequence[Reward]:
        statement = sql.select(Reward).where(Reward.repository_id == repository_id)
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues


reward = RewardActions(Reward)
