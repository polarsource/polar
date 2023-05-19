from __future__ import annotations
from sqlalchemy import desc
import structlog
from polar.backoffice.schemas import BackofficePledgeRead
from polar.kit.extensions.sqlalchemy import sql
from sqlalchemy.orm import (
    joinedload,
)
from polar.models.account import Account
from polar.models.issue import Issue
from polar.models.pledge import Pledge
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession


log = structlog.get_logger()


class BackofficePledgeService:
    async def list_pledges(
        self, session: AsyncSession, customers: bool | None = None
    ) -> list[BackofficePledgeRead]:
        stmt = sql.select(Pledge).options(
            joinedload(Pledge.organization),
            joinedload(Pledge.user),
            joinedload(Pledge.issue).joinedload(Issue.organization),
            joinedload(Pledge.issue).joinedload(Issue.repository),
        )

        stmt = stmt.join(
            Account, Account.organization_id == Pledge.organization_id, isouter=True
        )

        stmt = stmt.where(Pledge.state != PledgeState.initiated)

        # Pledges to customers
        if customers is True:
            stmt = stmt.where(Account.id.is_not(None))

        # Pledges to non customers
        if customers is False:
            stmt = stmt.where(Account.id.is_(None))

        stmt = stmt.order_by(desc(Pledge.created_at))

        res = await session.execute(stmt)
        pledges = res.scalars().unique().all()
        return [BackofficePledgeRead.from_db(p) for p in pledges]


bo_pledges_service = BackofficePledgeService()
