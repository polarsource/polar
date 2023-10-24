from collections.abc import Sequence
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import Select, UnaryExpression, and_, desc, func, or_, select, text
from sqlalchemy.orm import contains_eager

from polar.authz.service import Anonymous, Subject
from polar.funding.schemas import FundingResultType
from polar.kit.pagination import PaginationParams, paginate
from polar.models import Issue, Organization, Pledge, Repository, UserOrganization
from polar.pledge.schemas import PledgeState, PledgeType
from polar.postgres import AsyncSession


class ListFundingSortBy(StrEnum):
    oldest = "oldest"
    newest = "newest"
    most_funded = "most_funded"
    most_engagement = "most_engagement"


class FundingService:
    async def list_by(
        self,
        session: AsyncSession,
        auth_subject: Subject,
        *,
        organization: Organization | None = None,
        repository: Repository | None = None,
        badged: bool | None = None,
        closed: bool | None = None,
        sorting: list[ListFundingSortBy] = [ListFundingSortBy.oldest],
        issue_ids: list[UUID] | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[FundingResultType], int]:
        statement = self._get_readable_issues_statement(auth_subject)
        statement = self._apply_pledges_summary_statement(statement)
        count_statement = self._get_readable_issues_statement(
            auth_subject
        ).with_only_columns(func.count(Issue.id))

        if organization is not None:
            statement = statement.where(Organization.id == organization.id)
            count_statement = count_statement.where(Organization.id == organization.id)

        if repository is not None:
            statement = statement.where(Repository.id == repository.id)
            count_statement = count_statement.where(Repository.id == repository.id)

        if issue_ids is not None:
            statement = statement.where(Issue.id.in_(issue_ids))
            count_statement = count_statement.where(Issue.id.in_(issue_ids))

        if badged is not None:
            statement = statement.where(Issue.pledge_badge_currently_embedded == badged)
            count_statement = count_statement.where(
                Issue.pledge_badge_currently_embedded == badged
            )

        if closed is not None:
            statement = statement.where(Issue.closed == closed)
            count_statement = count_statement.where(Issue.closed == closed)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion in sorting:
            if criterion == ListFundingSortBy.oldest:
                order_by_clauses.append(Issue.created_at.asc())
            elif criterion == ListFundingSortBy.newest:
                order_by_clauses.append(Issue.created_at.desc())
            elif criterion == ListFundingSortBy.most_funded:
                order_by_clauses.append(desc(text("total")))
            elif criterion == ListFundingSortBy.most_engagement:
                order_by_clauses.append(Issue.total_engagement_count.desc())
        statement = statement.order_by(*order_by_clauses)

        results, count = await paginate(
            session,
            statement,
            pagination=pagination,
            count_clause=count_statement.scalar_subquery(),
        )

        return results, count

    async def get_by_issue_id(
        self, session: AsyncSession, auth_subject: Subject, *, issue_id: UUID
    ) -> FundingResultType | None:
        statement = self._get_readable_issues_statement(auth_subject)
        statement = self._apply_pledges_summary_statement(statement)
        statement = statement.where(Issue.id == issue_id)
        result = await session.execute(statement)

        row = result.unique().one_or_none()
        if row is not None:
            return row._tuple() if row is not None else None
        return row

    def _get_readable_issues_statement(self, auth_subject: Subject) -> Select[Any]:
        statement = select(Issue).join(Issue.repository).join(Repository.organization)
        if isinstance(auth_subject, Anonymous):
            return statement.where(Repository.is_private.is_(False))

        return statement.join(
            UserOrganization,
            isouter=True,
            onclause=and_(
                UserOrganization.organization_id == Organization.id,
                UserOrganization.user_id == auth_subject.id,
            ),
        ).where(
            or_(
                Repository.is_private.is_(False),
                UserOrganization.user_id == auth_subject.id,
            )
        )

    def _apply_pledges_summary_statement(self, statement: Select[Any]) -> Select[Any]:
        issue_pledges_eager_loading_clause = contains_eager(Issue.pledges)
        total_column = func.coalesce(
            func.sum(Pledge.amount).over(partition_by=Issue.id),
            0,
        ).label("total")
        statement = (
            statement.join(
                Pledge,
                onclause=and_(
                    Pledge.issue_id == Issue.id,
                    Pledge.state.in_(PledgeState.active_states()),
                ),
                isouter=True,
            )
            .options(
                contains_eager(Issue.repository).contains_eager(Repository.organization)
            )
            .options(issue_pledges_eager_loading_clause.joinedload(Pledge.user))
            .options(
                issue_pledges_eager_loading_clause.joinedload(Pledge.by_organization)
            )
            .options(
                issue_pledges_eager_loading_clause.joinedload(
                    Pledge.on_behalf_of_organization
                )
            )
            .add_columns(total_column)
        )

        for pledge_type in PledgeType:
            statement = statement.add_columns(
                func.coalesce(
                    func.sum(Pledge.amount)
                    .filter(
                        Pledge.type == pledge_type,
                    )
                    .over(partition_by=Issue.id),
                    0,
                ).label(f"{pledge_type}_total"),
            )

        return statement


funding = FundingService()
