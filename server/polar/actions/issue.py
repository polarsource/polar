from __future__ import annotations

from typing import Sequence

import structlog
from sqlalchemy.orm import InstrumentedAttribute

from polar.actions.base import Action
from polar.kit.extensions.sqlalchemy import GUID
from polar.models.issue import Issue
from polar.platforms import Platforms
from polar.postgres import AsyncSession, sql
from polar.schema.issue import IssueCreate, IssueUpdate

log = structlog.get_logger()


class IssueActions(Action[Issue, IssueCreate, IssueUpdate]):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
        return [self.model.external_id]

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Issue | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def list_by_repository(
        self, session: AsyncSession, repository_id: GUID
    ) -> Sequence[Issue]:
        statement = sql.select(Issue).where(Issue.repository_id == repository_id)
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues


issue = IssueActions(Issue)
