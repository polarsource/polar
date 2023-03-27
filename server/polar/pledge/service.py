from __future__ import annotations

from uuid import UUID
from typing import List, Sequence

import structlog

from polar.kit.services import ResourceService
from polar.models.user import User
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession, sql
from polar.exceptions import ResourceNotFound

from .schemas import PledgeCreate, PledgeUpdate, State

log = structlog.get_logger()


class PledgeService(ResourceService[Pledge, PledgeCreate, PledgeUpdate]):
    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[Pledge]:
        statement = sql.select(Pledge).where(Pledge.repository_id == repository_id)
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def get_by_issue_ids(
        self,
        session: AsyncSession,
        issue_ids: List[UUID],
    ) -> Sequence[Pledge]:
        if not issue_ids:
            return []
        statement = sql.select(Pledge).filter(Pledge.issue_id.in_(issue_ids))
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def connect_backer(
        self,
        session: AsyncSession,
        pledge_id: UUID,
        backer: User,
    ) -> None:
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")

        pledge.backer_user_id = backer.id
        session.add(pledge)
        await session.commit()

    async def mark_pending_by_issue_id(
        self, session: AsyncSession, issue_id: UUID
    ) -> None:
        statement = (
            sql.update(Pledge)
            .where(Pledge.issue_id == issue_id, Pledge.state == State.created)
            .values(status=State.pending)
        )
        await session.execute(statement)
        await session.commit()


pledge = PledgeService(Pledge)
