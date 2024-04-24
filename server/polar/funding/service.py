from collections.abc import Sequence
from enum import StrEnum
from typing import Any, TypeVar, cast
from uuid import UUID

from sqlalchemy import (
    Select,
    UnaryExpression,
    and_,
    desc,
    func,
    nulls_last,
    or_,
    select,
)
from sqlalchemy.orm import contains_eager, load_only

from polar.authz.service import Anonymous, Subject
from polar.funding.schemas import FundingResultType
from polar.issue.search import search_query
from polar.kit.pagination import PaginationParams
from polar.models import Issue, Organization, Pledge, Repository, UserOrganization
from polar.models.pledge import PledgeState, PledgeType
from polar.models.user import OAuthAccount, OAuthPlatform, User
from polar.postgres import AsyncSession


class ListFundingSortBy(StrEnum):
    oldest = "oldest"
    newest = "newest"
    most_funded = "most_funded"
    most_recently_funded = "most_recently_funded"
    most_engagement = "most_engagement"


T = TypeVar("T", bound=tuple[Any])


class FundingService:
    async def list_by(
        self,
        session: AsyncSession,
        auth_subject: Subject,
        *,
        query: str | None = None,
        organization: Organization | None = None,
        repository: Repository | None = None,
        badged: bool | None = None,
        closed: bool | None = None,
        sorting: list[ListFundingSortBy] = [ListFundingSortBy.oldest],
        issue_ids: list[UUID] | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[FundingResultType], int]:
        # Construct a inner statement that returns a list of Issue.id's
        # We're applying pagination and sorting to this inner statement
        inner_statement = self._get_readable_issue_ids_statement(auth_subject)
        count_statement = self._get_readable_issues_statement(
            auth_subject
        ).with_only_columns(func.count(Issue.id))

        order_by_clauses: list[UnaryExpression[Any]] = []

        if query is not None:
            search = search_query(query)

            inner_statement = inner_statement.where(
                Issue.title_tsv.bool_op("@@")(func.to_tsquery(search))
            )
            count_statement = count_statement.where(
                Issue.title_tsv.bool_op("@@")(func.to_tsquery(search))
            )

            # No matter the sorting option, always add a relevance sort first
            order_by_clauses.append(
                desc(func.ts_rank_cd(Issue.title_tsv, func.to_tsquery(search)))
            )

        if organization is not None:
            inner_statement = inner_statement.where(Organization.id == organization.id)
            count_statement = count_statement.where(Organization.id == organization.id)

        if repository is not None:
            inner_statement = inner_statement.where(Repository.id == repository.id)
            count_statement = count_statement.where(Repository.id == repository.id)

        if issue_ids is not None:
            inner_statement = inner_statement.where(Issue.id.in_(issue_ids))
            count_statement = count_statement.where(Issue.id.in_(issue_ids))

        if badged is not None:
            inner_statement = inner_statement.where(
                Issue.pledge_badge_currently_embedded == badged
            )
            count_statement = count_statement.where(
                Issue.pledge_badge_currently_embedded == badged
            )

        if closed is not None:
            inner_statement = inner_statement.where(Issue.closed == closed)
            count_statement = count_statement.where(Issue.closed == closed)

        for criterion in sorting:
            if criterion == ListFundingSortBy.oldest:
                order_by_clauses.append(Issue.created_at.asc())
            elif criterion == ListFundingSortBy.newest:
                order_by_clauses.append(Issue.created_at.desc())
            elif criterion == ListFundingSortBy.most_funded:
                order_by_clauses.append(nulls_last(desc(Issue.pledged_amount_sum)))
            elif criterion == ListFundingSortBy.most_recently_funded:
                order_by_clauses.append(nulls_last(desc(Issue.last_pledged_at)))
            elif criterion == ListFundingSortBy.most_engagement:
                order_by_clauses.append(Issue.total_engagement_count.desc())
        inner_statement = inner_statement.order_by(*order_by_clauses)

        # paginate on inner query (issue listing)
        page, limit = pagination
        offset = limit * (page - 1)
        inner_statement = inner_statement.offset(offset).limit(limit)

        # Given a list of issues, join in the pledges
        outer_statement = self._apply_pledges_summary_statement(
            self._get_readable_issues_statement(auth_subject).where(
                Issue.id.in_(inner_statement)
            )
        )

        # Also add organization filter to the outer query.
        # This does not affect the result of the query, but does significantly improve performance
        if organization is not None:
            outer_statement = outer_statement.where(
                Issue.organization_id == organization.id
            )

        outer_statement = outer_statement.order_by(*order_by_clauses)
        outer_statement = outer_statement.add_columns(count_statement.scalar_subquery())

        result = await session.execute(outer_statement)

        results: list[Any] = []
        count: int = 0
        for row in result.unique().all():
            (*queried_data, c) = row._tuple()
            count = int(c)
            if len(queried_data) == 1:
                results.append(queried_data[0])
            else:
                results.append(queried_data)

        return results, count

    async def get_by_issue_id(
        self, session: AsyncSession, auth_subject: Subject, *, issue_id: UUID
    ) -> FundingResultType | None:
        statement = self._apply_pledges_summary_statement(
            self._get_readable_issues_statement(auth_subject)
        )
        statement = statement.where(Issue.id == issue_id)
        result = await session.execute(statement)

        row = result.unique().one_or_none()
        if row is not None:
            return row._tuple() if row is not None else None
        return row

    def _get_readable_issue_ids_statement(
        self, auth_subject: Subject
    ) -> Select[tuple[int]]:
        return self._apply_readable_issues_statement(select(Issue.id), auth_subject)

    def _get_readable_issues_statement(
        self, auth_subject: Subject
    ) -> Select[tuple[Issue]]:
        return self._apply_readable_issues_statement(select(Issue), auth_subject)

    def _apply_readable_issues_statement(
        self, selector: Select[T], auth_subject: Subject
    ) -> Select[T]:
        statement = (
            selector.join(Issue.repository)
            .join(Repository.organization)
            .where(
                Issue.deleted_at.is_(None),
                Repository.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
            )
        )

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
            ),
        )

    def _apply_pledges_summary_statement(
        self, statement: Select[tuple[Issue]]
    ) -> Select[FundingResultType]:
        issue_pledges_eager_loading_clause = contains_eager(Issue.pledges)
        total_column = func.coalesce(
            func.sum(Pledge.amount).over(partition_by=Issue.id),
            0,
        ).label("total")
        last_pledged_at_column = func.coalesce(
            func.max(Pledge.created_at).over(partition_by=Issue.id)
        ).label("last_pledged_at")
        statement = (
            statement.join(
                Pledge,
                onclause=and_(
                    Pledge.issue_id == Issue.id,
                    Pledge.state.in_(PledgeState.active_states()),
                ),
                isouter=True,
            )
            .join(
                Pledge.user,
                isouter=True,
            )
            .join(
                OAuthAccount,
                onclause=and_(
                    # Only load github oauth accounts:
                    # This prevents us from returning multiple rows per identity,
                    # which would lead to over-counting the pledges.
                    #
                    # If we want to support showing other identities in the funding API, we'd need to solve this in another way.
                    OAuthAccount.user_id == User.id,
                    OAuthAccount.platform == OAuthPlatform.github,
                ),
                isouter=True,
            )
            .options(
                contains_eager(Issue.repository).contains_eager(Repository.organization)
            )
            .options(
                issue_pledges_eager_loading_clause.contains_eager(Pledge.user).options(
                    load_only(
                        User.id,
                        User.avatar_url,
                        User.email,
                    ),
                    contains_eager(User.oauth_accounts),
                )
            )
            .options(
                issue_pledges_eager_loading_clause.joinedload(Pledge.by_organization)
            )
            .options(
                issue_pledges_eager_loading_clause.joinedload(
                    Pledge.on_behalf_of_organization
                )
            )
            .add_columns(total_column, last_pledged_at_column)
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

        return cast(Select[FundingResultType], statement)


funding = FundingService()
