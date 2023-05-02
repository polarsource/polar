from __future__ import annotations

from uuid import UUID
from typing import List, Sequence

import structlog

from polar.kit.services import ResourceService
from polar.models.issue import Issue
from polar.models.pledge_transaction import PledgeTransaction
from polar.models.user import User
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession, sql
from sqlalchemy.orm import (
    joinedload,
)
from polar.organization.service import organization as organization_service
from polar.account.service import account as account_service
from polar.exceptions import ResourceNotFound, NotPermitted

from .schemas import PledgeCreate, PledgeTransactionType, PledgeUpdate, PledgeState

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
                joinedload(Pledge.issue).joinedload(Issue.organization),
                joinedload(Pledge.issue).joinedload(Issue.repository),
            )
            .filter(Pledge.id == pledge_id)
            .where(Pledge.state != PledgeState.initiated)
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[Pledge]:
        statement = (
            sql.select(Pledge)
            .where(
                Pledge.repository_id == repository_id,
                Pledge.state != PledgeState.initiated,
            )
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
            .where(Pledge.by_user_id == user_id, Pledge.state != PledgeState.initiated)
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
            .filter(
                Pledge.issue_id.in_(issue_ids), Pledge.state != PledgeState.initiated
            )
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
            .where(Pledge.issue_id == issue_id, Pledge.state == PledgeState.created)
            .values(state=PledgeState.pending)
        )
        await session.execute(statement)
        await session.commit()

    async def mark_pending_by_pledge_id(
        self, session: AsyncSession, pledge_id: UUID
    ) -> None:
        statement = (
            sql.update(Pledge)
            .where(Pledge.id == pledge_id, Pledge.state == PledgeState.created)
            .values(state=PledgeState.pending)
        )
        await session.execute(statement)
        await session.commit()

    async def mark_created_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if pledge:
            pledge.state = PledgeState.created
            session.add(pledge)
            session.add(
                PledgeTransaction(
                    pledge_id=pledge.id,
                    type=PledgeTransactionType.pledge,
                    amount=amount,
                    transaction_id=transaction_id,
                )
            )
            await session.commit()

    async def mark_paid_by_pledge_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if pledge:
            pledge.state = PledgeState.paid
            session.add(pledge)
            session.add(
                PledgeTransaction(
                    pledge_id=pledge.id,
                    type=PledgeTransactionType.transfer,
                    amount=amount,
                    transaction_id=transaction_id,
                )
            )
            await session.commit()

    async def refund_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if pledge:
            if pledge.state in [PledgeState.created, PledgeState.pending]:
                if amount == pledge.amount:
                    pledge.state = PledgeState.refunded
                elif amount < pledge.amount:
                    pledge.amount -= amount
                else:
                    # Not possible
                    ...
            else:
                # TODO: Log to sentry
                ...

            session.add(pledge)
            session.add(
                PledgeTransaction(
                    pledge_id=pledge.id,
                    type=PledgeTransactionType.refund,
                    amount=amount,
                    transaction_id=transaction_id,
                )
            )
            await session.commit()

    async def transfer(self, session: AsyncSession, pledge_id: UUID) -> None:
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")
        if pledge.state != PledgeState.pending:
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
            transfer_group=f"{pledge.id}",
        )

        if transfer_id is None:
            raise NotPermitted("Transfer failed")  # TODO: Better error

        await self.mark_paid_by_pledge_id(
            session, pledge.payment_id, organization_share, transfer_id
        )

    async def get_by_payment_id(
        self, session: AsyncSession, payment_id: str
    ) -> Pledge | None:
        return await Pledge.find_by(
            session=session,
            payment_id=payment_id,
        )

    async def set_issue_pledged_amount_sum(
        self,
        session: AsyncSession,
        issue_id: UUID,
    ) -> None:
        pledges = await self.get_by_issue_ids(session, issue_ids=[issue_id])

        summed = 0
        if pledges:
            summed = sum([p.amount for p in pledges])

        stmt = (
            sql.update(Issue)
            .where(Issue.id == issue_id)
            .values(pledged_amount_sum=summed)
        )

        await session.execute(stmt)
        await session.commit()


pledge = PledgeService(Pledge)
