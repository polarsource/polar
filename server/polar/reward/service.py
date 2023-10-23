from typing import Sequence, Tuple
from uuid import UUID

import structlog
from sqlalchemy import and_
from sqlalchemy.orm import (
    joinedload,
)

from polar.models.issue import Issue
from polar.models.issue_reward import IssueReward
from polar.models.pledge import Pledge
from polar.models.pledge_transaction import PledgeTransaction
from polar.models.repository import Repository
from polar.models.user import User
from polar.pledge.schemas import PledgeState, PledgeTransactionType
from polar.postgres import AsyncSession, sql

log = structlog.get_logger()


class RewardService:
    async def list(
        self,
        session: AsyncSession,
        pledge_org_id: UUID | None = None,
        issue_id: UUID | None = None,
        issue_ids: list[UUID] | None = None,
        reward_org_id: UUID | None = None,
        reward_user_id: UUID | None = None,
        is_transfered: bool | None = None,
    ) -> Sequence[Tuple[Pledge, IssueReward, PledgeTransaction]]:
        statement = (
            (
                sql.select(Pledge, IssueReward, PledgeTransaction)
                .join(Pledge.issue)
                .join(IssueReward, Issue.id == IssueReward.issue_id)
                .join(
                    PledgeTransaction,
                    and_(
                        PledgeTransaction.pledge_id == Pledge.id,
                        PledgeTransaction.issue_reward_id == IssueReward.id,
                        PledgeTransaction.type == PledgeTransactionType.transfer,
                    ),
                    isouter=True,
                )
            )
            .where(Pledge.state.in_(PledgeState.active_states()))
            .order_by(Pledge.created_at)
        )

        if pledge_org_id:
            statement = statement.where(Pledge.organization_id == pledge_org_id)

        if issue_id:
            statement = statement.where(Pledge.issue_id == issue_id)

        if issue_ids is not None:
            statement = statement.where(Pledge.issue_id.in_(issue_ids))

        if reward_org_id:
            statement = statement.where(IssueReward.organization_id == reward_org_id)

        if reward_user_id:
            statement = statement.where(IssueReward.user_id == reward_user_id)

        if is_transfered is not None:
            if is_transfered:
                statement = statement.where(PledgeTransaction.id.is_not(None))
            else:
                statement = statement.where(PledgeTransaction.id.is_(None))

        statement = statement.options(
            joinedload(IssueReward.user),
            joinedload(IssueReward.organization),
            joinedload(Pledge.issue)
            .joinedload(Issue.repository)
            .joinedload(Repository.organization),
            joinedload(Pledge.by_organization),
            joinedload(Pledge.user),
            joinedload(Pledge.on_behalf_of_organization),
            joinedload(Pledge.created_by_user),
        )

        res = await session.execute(statement)
        rows = res.unique().all()

        return [r._tuple() for r in rows]

    async def get(
        self,
        session: AsyncSession,
        pledge_id: UUID,
        issue_reward_id: UUID,
    ) -> Tuple[Pledge, IssueReward, PledgeTransaction] | None:
        statement = (
            sql.select(Pledge, IssueReward, PledgeTransaction)
            .join(Pledge.issue)
            .join(IssueReward, Issue.id == IssueReward.issue_id)
            .join(
                PledgeTransaction,
                and_(
                    PledgeTransaction.pledge_id == Pledge.id,
                    PledgeTransaction.issue_reward_id == IssueReward.id,
                    PledgeTransaction.type == PledgeTransactionType.transfer,
                ),
                isouter=True,
            )
        )

        statement = statement.where(
            Pledge.id == pledge_id, IssueReward.id == issue_reward_id
        )

        statement = statement.options(
            joinedload(IssueReward.user),
            joinedload(IssueReward.organization),
            joinedload(Pledge.issue)
            .joinedload(Issue.repository)
            .joinedload(Repository.organization),
            joinedload(Pledge.by_organization),
            joinedload(Pledge.user),
            joinedload(Pledge.on_behalf_of_organization),
        )

        res = await session.execute(statement)

        r = res.unique().one_or_none()

        if r:
            return r._tuple()

        return None

    async def connect_by_username(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        stmt = (
            sql.update(IssueReward)
            .where(
                IssueReward.github_username == user.username,
                IssueReward.user_id.is_(None),
            )
            .values(user_id=user.id)
        )
        await session.execute(stmt)
        await session.commit()


reward_service = RewardService()
