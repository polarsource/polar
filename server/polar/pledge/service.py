from __future__ import annotations

from uuid import UUID
from typing import List, Sequence

import structlog

from polar.kit.services import ResourceService
from polar.models.user import User
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession, sql
from sqlalchemy.orm import (
    joinedload,
)
from polar.organization.service import organization as organization_service
from polar.account.service import account as account_service
from polar.exceptions import ResourceNotFound, NotPermitted

from .schemas import PledgeCreate, PledgeUpdate, State

log = structlog.get_logger()


class PledgeService(ResourceService[Pledge, PledgeCreate, PledgeUpdate]):
    async def get_with_loaded(
        self,
        session: AsyncSession,
        pledge_id: UUID,
    ) -> Pledge | None:
        statement = (
            sql.select(Pledge)
            .options(
                joinedload(Pledge.user),
                joinedload(Pledge.organization),
            )
            .filter(Pledge.id == pledge_id)
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[Pledge]:
        statement = (
            sql.select(Pledge)
            .where(Pledge.repository_id == repository_id)
            .options(
                joinedload(Pledge.user),
                joinedload(Pledge.organization),
            )
        )
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def list_by_pledging_user(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Pledge]:
        statement = (
            sql.select(Pledge)
            .where(Pledge.by_user_id == user_id)
            .options(
                joinedload(Pledge.user),
                joinedload(Pledge.organization),
            )
        )
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
        statement = (
            sql.select(Pledge)
            .options(
                joinedload(Pledge.user),
                joinedload(Pledge.organization),
            )
            .filter(Pledge.issue_id.in_(issue_ids))
        )
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

        pledge.by_user_id = backer.id
        await pledge.save(session)

        # Approve the user for the alpha!
        backer.invite_only_approved = True
        await backer.save(session)

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

    async def mark_pending_by_pledge_id(
        self, session: AsyncSession, pledge_id: UUID
    ) -> None:
        statement = (
            sql.update(Pledge)
            .where(Pledge.id == pledge_id, Pledge.state == State.created)
            .values(state=State.pending)
        )
        await session.execute(statement)
        await session.commit()

    async def transfer(self, session: AsyncSession, pledge_id: UUID) -> None:
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

    async def get_by_payment_id(
        self, session: AsyncSession, payment_id: str
    ) -> Pledge | None:
        return await Pledge.find_by(
            session=session,
            payment_id=payment_id,
        )


pledge = PledgeService(Pledge)
