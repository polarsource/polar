from collections.abc import Sequence
from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import Row, UnaryExpression, desc, func, select
from sqlalchemy.orm import joinedload, selectinload

from polar.models import Issue, Organization, Pledge, Repository
from polar.pledge.schemas import PledgeType
from polar.postgres import AsyncSession


class ListFundingSortBy(StrEnum):
    oldest = "oldest"
    newest = "newest"
    most_funded = "most_funded"
    most_engagement = "most_engagement"


ListByRowType = Row[tuple[Issue, Decimal, Decimal, Decimal, Decimal]]


class FundingService:
    async def list_by(
        self,
        session: AsyncSession,
        *,
        organization: Organization | None = None,
        repository: Repository | None = None,
        sorting: list[ListFundingSortBy] = [ListFundingSortBy.oldest],
    ) -> Sequence[ListByRowType]:
        statement = (
            select(Issue)
            .join(Pledge, onclause=Pledge.issue_id == Issue.id, full=True)
            .options(joinedload(Issue.repository).joinedload(Repository.organization))
            .options(selectinload(Issue.pledges).joinedload(Pledge.user))
            .options(selectinload(Issue.pledges).joinedload(Pledge.by_organization))
            .add_columns(
                func.coalesce(
                    func.sum(Pledge.amount).over(partition_by=Issue.id),
                    0,
                ).label("total"),
            )
        )

        for pledge_type in PledgeType:
            statement = statement.add_columns(
                func.coalesce(
                    func.sum(Pledge.amount)
                    .filter(Pledge.type == pledge_type)
                    .over(partition_by=Issue.id),
                    0,
                ).label(f"{pledge_type}_total"),
            )

        if organization is not None:
            statement = statement.join(Issue.organization).where(
                Organization.id == organization.id
            )

        if repository is not None:
            statement = statement.join(Issue.repository).where(
                Repository.id == repository.id
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion in sorting:
            if criterion == ListFundingSortBy.oldest:
                order_by_clauses.append(Issue.created_at.asc())
            elif criterion == ListFundingSortBy.newest:
                order_by_clauses.append(Issue.created_at.desc())
            elif criterion == ListFundingSortBy.most_funded:
                order_by_clauses.append(desc("total"))
            elif criterion == ListFundingSortBy.most_engagement:
                order_by_clauses.append(Issue.total_engagement_count.desc())
        statement = statement.order_by(*order_by_clauses)

        result = await session.execute(statement)
        return result.unique().all()


funding = FundingService()
