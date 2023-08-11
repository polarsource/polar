from typing import List, Sequence, Tuple
from uuid import UUID

import structlog
from sqlalchemy import and_
from sqlalchemy.orm import (
    joinedload,
)

from polar.models.issue import Issue
from polar.models.pledge import Pledge
from polar.models.pledge_split import PledgeSplit
from polar.models.pledge_transaction import PledgeTransaction
from polar.models.repository import Repository
from polar.pledge.schemas import PledgeTransactionType
from polar.postgres import AsyncSession, sql

log = structlog.get_logger()


class RewardService:
    async def list(
        self,
        session: AsyncSession,
        # pledge_id: UUID,
        org_id: UUID,
    ) -> Sequence[Tuple[Pledge, PledgeSplit, PledgeTransaction]]:
        statement = (
            sql.select(Pledge, PledgeSplit, PledgeTransaction)
            .join(Pledge.issue)
            .join(PledgeSplit, Issue.id == PledgeSplit.issue_id)
            .join(
                PledgeTransaction,
                and_(
                    PledgeTransaction.pledge_id == Pledge.id,
                    PledgeTransaction.pledge_split_id == PledgeSplit.id,
                    PledgeTransaction.type == PledgeTransactionType.transfer,
                ),
                isouter=True,
            )
            .where(Pledge.organization_id == org_id)
            .options(
                # joinedload(Pledge.user),
                # joinedload(Pledge.by_organization),
                # joinedload(Pledge.issue).joinedload(Issue.organization),
                joinedload(PledgeSplit.user),
                joinedload(PledgeSplit.organization),
                joinedload(Pledge.issue)
                .joinedload(Issue.repository)
                .joinedload(Repository.organization),
            )
            #     .filter(Pledge.id == pledge_id)
        )
        res = await session.execute(statement)
        rows = res.unique().all()

        # for r in rows:

        return [r._tuple() for r in rows]
        # return res.scalars().all()


reward_service = RewardService()
