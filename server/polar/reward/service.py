from __future__ import annotations

from uuid import UUID
from typing import Sequence

import structlog

from polar.kit.services import ResourceService
from polar.models.reward import Reward
from polar.postgres import AsyncSession, sql

from .schemas import RewardCreate, RewardUpdate

log = structlog.get_logger()


class RewardService(ResourceService[Reward, RewardCreate, RewardUpdate]):
    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[Reward]:
        statement = sql.select(Reward).where(Reward.repository_id == repository_id)
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues


reward = RewardService(Reward)
