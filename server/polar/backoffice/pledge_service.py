from __future__ import annotations

import structlog
from sqlalchemy import desc
from sqlalchemy.orm import (
    joinedload,
)

from polar.backoffice.schemas import BackofficePledge
from polar.kit.extensions.sqlalchemy import sql
from polar.models.account import Account
from polar.models.issue import Issue
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession

log = structlog.get_logger()


class BackofficePledgeService:
    async def list_pledges(self, session: AsyncSession) -> list[BackofficePledge]:
        stmt = sql.select(Pledge).options(
            joinedload(Pledge.by_organization),
            joinedload(Pledge.to_organization),
            joinedload(Pledge.user),
            joinedload(Pledge.issue)
            .joinedload(Issue.repository)
            .joinedload(Repository.organization),
        )

        stmt = stmt.join(
            Account, Account.organization_id == Pledge.organization_id, isouter=True
        )

        stmt = stmt.where(Pledge.state != PledgeState.initiated)

        stmt = stmt.order_by(desc(Pledge.created_at))

        res = await session.execute(stmt)
        pledges = res.scalars().unique().all()
        return [BackofficePledge.from_db(p) for p in pledges]


bo_pledges_service = BackofficePledgeService()
