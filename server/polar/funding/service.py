from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import Row, func, select
from sqlalchemy.orm import joinedload, selectinload

from polar.models import Issue, Organization, Pledge, Repository
from polar.pledge.schemas import PledgeType
from polar.postgres import AsyncSession

ListByRowType = Row[tuple[Issue, Decimal, Decimal, Decimal, Decimal]]


class FundingService:
    async def list_by(
        self,
        session: AsyncSession,
        *,
        organization: Organization | None = None,
        repository: Repository | None = None,
    ) -> Sequence[ListByRowType]:
        statement = (
            select(Issue)
            .join(Pledge, onclause=Pledge.issue_id == Issue.id, full=True)
            .options(joinedload(Issue.repository).joinedload(Repository.organization))
            .options(selectinload(Issue.pledges).joinedload(Pledge.user))
            .options(selectinload(Issue.pledges).joinedload(Pledge.by_organization))
            .add_columns(
                func.coalesce(
                    func.sum(Pledge.amount).over(partition_by=Issue.id).label("total"),
                    0,
                ),
            )
            .order_by(Issue.created_at)
        )

        for pledge_type in PledgeType:
            statement = statement.add_columns(
                func.coalesce(
                    func.sum(Pledge.amount)
                    .filter(Pledge.type == pledge_type)
                    .over(partition_by=Issue.id)
                    .label(f"{pledge_type}_total"),
                    0,
                ),
            )

        if organization is not None:
            statement = statement.join(Issue.organization).where(
                Organization.id == organization.id
            )

        if repository is not None:
            statement = statement.join(Issue.repository).where(
                Repository.id == repository.id
            )

        r = await session.execute(statement)
        return r.unique().all()


funding = FundingService()
