from __future__ import annotations

from uuid import UUID
from typing import List, Sequence

import structlog

from polar.kit.services import ResourceService
from polar.models.user import User
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession, sql
from polar.organization.service import organization as organization_service
from polar.account.service import account as account_service
from polar.exceptions import ResourceNotFound, NotPermitted

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
            .values(state=State.pending)
        )
        await session.execute(statement)
        await session.commit()

    async def payout(self, session: AsyncSession, pledge_id: UUID) -> None:
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")
        if pledge.state != State.pending:
            raise NotPermitted("Pledge is not in pending state")

        organization = await organization_service.get(
            session, id=pledge.organization_id
        )
        if organization is None or organization.account is None:
            raise NotPermitted("Organization has no account")

        organization_share = round(pledge.amount * 0.9)  # TODO: proper calculation
        transfer_id = account_service.transfer(
            session=session,
            account=organization.account,
            amount=organization_share,
            transfer_group=f"{pledge.issue_id}",
        )

        if transfer_id is None:
            raise NotPermitted("Transfer failed")  # TODO: Better error

        pledge.state = State.paid
        pledge.transfer_id = transfer_id
        await pledge.save(session=session)


pledge = PledgeService(Pledge)
