from __future__ import annotations
from uuid import UUID


import structlog
from polar.backoffice.schemas import BackofficePledgeRead
from polar.kit.extensions.sqlalchemy import sql
from sqlalchemy.orm import (
    joinedload,
)
from polar.models.issue import Issue

from polar.models.pledge import Pledge

from polar.models.user import User

from polar.models.account import Account
from polar.postgres import AsyncSession
from polar.enums import AccountType
from polar.integrations.stripe.service import stripe


log = structlog.get_logger()


class BackofficePledgeService:
    async def list_pledges(
        self,
        session: AsyncSession,
    ) -> list[BackofficePledgeRead]:
        stmt = sql.select(Pledge).options(
            joinedload(Pledge.organization),
            joinedload(Pledge.user),
            joinedload(Pledge.issue).joinedload(Issue.organization),
            joinedload(Pledge.issue).joinedload(Issue.repository),
        )
        res = await session.execute(stmt)
        pledges = res.scalars().unique().all()
        return [BackofficePledgeRead.from_db(p) for p in pledges]


bo_pledges_service = BackofficePledgeService()
