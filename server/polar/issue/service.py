from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

import structlog
from sqlalchemy import (
    ColumnElement,
    Integer,
    and_,
    asc,
    desc,
    func,
    not_,
    nullslast,
    or_,
)
from sqlalchemy.orm import InstrumentedAttribute, aliased, contains_eager, joinedload

from polar.dashboard.schemas import IssueListType, IssueSortBy, IssueStatus
from polar.enums import Platforms
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models.issue import Issue
from polar.models.issue_dependency import IssueDependency
from polar.models.issue_reference import IssueReference
from polar.models.issue_reward import IssueReward
from polar.models.notification import Notification
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.pledge.schemas import PledgeState
from polar.postgres import AsyncSession, sql

from .schemas import IssueCreate, IssueUpdate

log = structlog.get_logger()


class IssueService(ResourceService[Issue, IssueCreate, IssueUpdate]):
    async def create(
        self,
        session: AsyncSession,
        create_schema: IssueCreate,
        autocommit: bool = True,
    ) -> Issue:
        return await Issue(
            platform=create_schema.platform,
            external_id=create_schema.external_id,
            organization_id=create_schema.organization_id,
            repository_id=create_schema.repository_id,
            number=create_schema.number,
            title=create_schema.title,
            body=create_schema.body,
            comments=create_schema.comments,
            author=create_schema.author,
            author_association=create_schema.author_association,
            labels=create_schema.labels,
            assignee=create_schema.assignee,
            assignees=create_schema.assignees,
            milestone=create_schema.milestone,
            closed_by=create_schema.closed_by,
            reactions=create_schema.reactions,
            state=create_schema.state,
            state_reason=create_schema.state_reason,
            issue_closed_at=create_schema.issue_closed_at,
            issue_modified_at=create_schema.issue_modified_at,
            issue_created_at=create_schema.issue_created_at,
            external_lookup_key=create_schema.external_lookup_key,
            has_pledge_badge_label=create_schema.has_pledge_badge_label,
            pledge_badge_embedded_at=create_schema.pledge_badge_embedded_at,
            positive_reactions_count=create_schema.positive_reactions_count,
            total_engagement_count=create_schema.total_engagement_count,
            #
            issue_has_in_progress_relationship=False,
            issue_has_pull_request_relationship=False,
        ).save(session, autocommit=autocommit)

    async def get_loaded(
        self,
        session: AsyncSession,
        id: UUID,
    ) -> Issue | None:
        statement = (
            sql.select(Issue)
            .where(Issue.id == id)
            .where(Issue.deleted_at.is_(None))
            .options(
                joinedload(Issue.repository),
                joinedload(Issue.repository).joinedload(Repository.organization),
            )
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Issue | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def get_by_number(
        self,
        session: AsyncSession,
        platform: Platforms,
        organization_id: UUID,
        repository_id: UUID,
        number: int,
    ) -> Issue | None:
        return await self.get_by(
            session,
            platform=platform,
            organization_id=organization_id,
            repository_id=repository_id,
            number=number,
        )

    async def get_by_external_lookup_key(
        self, session: AsyncSession, platform: Platforms, external_lookup_key: str
    ) -> Issue | None:
        return await self.get_by(
            session, platform=platform, external_lookup_key=external_lookup_key
        )

    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[Issue]:
        statement = sql.select(Issue).where(Issue.repository_id == repository_id)
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def list_by_repository_and_numbers(
        self, session: AsyncSession, repository_id: UUID, numbers: list[int]
    ) -> Sequence[Issue]:
        statement = (
            sql.select(Issue)
            .where(Issue.repository_id == repository_id)
            .where(Issue.number.in_(numbers))
        )
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def list_by_repository_type_and_status(
        self,
        session: AsyncSession,
        repository_ids: list[UUID] = [],
        text: str | None = None,
        pledged_by_org: UUID
        | None = None,  # Only include issues that have been pledged by this org
        pledged_by_user: UUID
        | None = None,  # Only include issues that have been pledged by this user
        have_pledge: bool | None = None,  # If issues have pledge or not
        load_references: bool = False,
        load_pledges: bool = False,
        load_repository: bool = False,
        sort_by: IssueSortBy = IssueSortBy.newest,
        offset: int = 0,
        limit: int | None = None,
        have_polar_badge: bool | None = None,  # If issue has the polar badge or not
        github_milestone_number: int | None = None,
        show_closed: bool = False,
        show_closed_if_needs_action: bool = False,
    ) -> tuple[Sequence[Issue], int]:  # (issues, total_issue_count)
        pledge_by_organization = aliased(Organization)
        issue_repository = aliased(Repository)
        issue_organization = aliased(Organization, name="pledge_organization")

        statement = (
            sql.select(
                Issue,
                sql.func.count().over().label("total_count"),
            )
            .join(
                Pledge,
                and_(
                    Pledge.issue_id == Issue.id,
                    Pledge.state.in_(PledgeState.active_states()),
                ),
                isouter=True,
            )
            .join(
                pledge_by_organization,
                Pledge.by_organization.of_type(pledge_by_organization),
                isouter=True,
            )
            .join(
                Pledge.user,
                isouter=True,
            )
        )

        # issues in repo
        if repository_ids:
            statement = statement.where(Issue.repository_id.in_(repository_ids))

        # issues with pledges by
        pledge_criterias: list[ColumnElement[bool]] = []
        if pledged_by_org:
            pledge_criterias.append(Pledge.by_organization_id == pledged_by_org)

        if pledged_by_user:
            pledge_criterias.append(Pledge.by_user_id == pledged_by_user)

        if len(pledge_criterias) > 0:
            statement = statement.where(
                or_(*pledge_criterias),
            )

        # pledge filter
        if have_pledge is not None:
            if have_pledge:
                statement = statement.where(Pledge.id.is_not(None))
            else:
                statement = statement.where(Pledge.id.is_(None))

        if have_polar_badge is not None:
            statement = statement.where(
                Issue.pledge_badge_currently_embedded == have_polar_badge
            )

        if github_milestone_number is not None:
            statement = statement.where(
                Issue.milestone["number"].cast(Integer) == github_milestone_number
            )

        if not show_closed and show_closed_if_needs_action:
            statement = statement.where(
                or_(
                    Issue.issue_closed_at.is_(None),
                    Issue.needs_confirmation_solved.is_(True),
                    # Show confirmed issues by default for 12 hours.
                    #
                    # This solves the problem where the issue suddenly is removed from
                    # listings after it's been confirmed. Which can be unexpected
                    # from a user point of view, and also causes som bugs in the UI,
                    # if an element that currently has spawned a modal disappears.
                    Issue.confirmed_solved_at > utc_now() - timedelta(hours=12),
                )
            )
        elif not show_closed:
            statement = statement.where(Issue.issue_closed_at.is_(None))

        # free text search
        if text:
            # Search in titles using the vector index
            # https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-PARSING-QUERIES
            #
            # The index supports fast matching of words and prefix-matching of words
            #
            # Here we're converting a user query like "feat cli" to
            # "feat:* | cli:*"
            words = text.split(" ")

            # remove empty words
            words = [w for w in words if len(w.strip()) > 0]

            # convert all words to prefix matches
            words = [f"{w}:*" for w in words]

            # OR all words
            search = " | ".join(words)

            statement = statement.where(
                Issue.title_tsv.bool_op("@@")(func.to_tsquery(search))
            )

            # Sort results based on matching
            if sort_by == IssueSortBy.relevance:
                statement = statement.order_by(
                    desc(func.ts_rank_cd(Issue.title_tsv, func.to_tsquery(search)))
                )

        if sort_by == IssueSortBy.issues_default:
            statement = statement.order_by(
                desc(Issue.pledged_amount_sum),
                desc(Issue.total_engagement_count),
                desc(Issue.issue_modified_at),
            )
        elif sort_by == IssueSortBy.newest:
            statement = statement.order_by(
                desc(Issue.issue_created_at),
            )
        elif sort_by == IssueSortBy.relevance:
            pass  # handled above
        elif sort_by == IssueSortBy.pledged_amount_desc:
            statement = statement.order_by(
                desc(Issue.pledged_amount_sum),
                desc(Issue.issue_modified_at),
            )
        elif sort_by == IssueSortBy.dependencies_default:
            statement = statement.order_by(
                nullslast(desc(sql.func.sum(Pledge.amount))),
                desc(Issue.issue_modified_at),
            )
        elif sort_by == IssueSortBy.recently_updated:
            statement = statement.order_by(desc(Issue.issue_modified_at))
        elif sort_by == IssueSortBy.least_recently_updated:
            statement = statement.order_by(asc(Issue.issue_modified_at))
        elif sort_by == IssueSortBy.most_engagement:
            statement = statement.order_by(
                desc(Issue.total_engagement_count),
                desc(Issue.issue_modified_at),
            )
        elif sort_by == IssueSortBy.most_positive_reactions:
            statement = statement.order_by(
                desc(Issue.positive_reactions_count),
                desc(Issue.issue_modified_at),
            )
        elif sort_by == IssueSortBy.funding_goal_desc_and_most_positive_reactions:
            statement = statement.order_by(
                nullslast(desc(Issue.funding_goal)),
                desc(Issue.positive_reactions_count),
                desc(Issue.issue_modified_at),
            )
        else:
            raise Exception("unknown sort_by")

        if load_references:
            statement = statement.options(
                joinedload(Issue.references).joinedload(IssueReference.pull_request)
            )

        if load_pledges:
            statement = statement.options(
                contains_eager(Issue.pledges),
                contains_eager(Issue.pledges).contains_eager(Pledge.user),
                contains_eager(Issue.pledges).contains_eager(
                    Pledge.by_organization.of_type(pledge_by_organization)
                ),
                contains_eager(Issue.pledges)
                .joinedload(Pledge.issue)
                .joinedload(Issue.repository)
                .joinedload(Repository.organization),
                contains_eager(Issue.pledges).joinedload(
                    Pledge.on_behalf_of_organization
                ),
                contains_eager(Issue.pledges).joinedload(Pledge.created_by_user),
            )
            statement = statement.group_by(
                Issue.id,
                Pledge.id,
                User.id,
                pledge_by_organization.id,
            )

        if load_repository:
            statement = statement.join(
                issue_repository,
                Issue.repository.of_type(issue_repository),
                isouter=False,
            )

            statement = statement.join(
                issue_organization, issue_repository.organization, isouter=False
            )

            statement = statement.options(
                contains_eager(
                    Issue.repository.of_type(issue_repository)
                ).contains_eager(
                    issue_repository.organization.of_type(issue_organization)
                )
            )

            statement = statement.group_by(
                Issue.id,
                issue_repository.id,
                issue_organization.id,
            )

        else:
            statement = statement.group_by(
                Issue.id,
            )

        if limit:
            statement = statement.limit(limit).offset(offset)

        res = await session.execute(statement)
        rows = res.unique().all()

        total_count = rows[0][1] if len(rows) > 0 else 0
        issues = [r[0] for r in rows]

        return (issues, total_count)

    async def list_issue_references(
        self,
        session: AsyncSession,
        issue: Issue,
    ) -> Sequence[IssueReference]:
        stmt = (
            sql.select(IssueReference)
            .where(
                IssueReference.issue_id == issue.id,
            )
            .options(joinedload(IssueReference.pull_request))
        )
        res = await session.execute(stmt)
        refs = res.scalars().unique().all()
        return refs

    async def list_issue_references_for_issues(
        self, session: AsyncSession, issue_ids: list[UUID]
    ) -> Sequence[IssueReference]:
        stmt = (
            sql.select(IssueReference)
            .where(
                IssueReference.issue_id.in_(issue_ids),
            )
            .options(joinedload(IssueReference.pull_request))
        )
        res = await session.execute(stmt)
        refs = res.scalars().unique().all()
        return refs

    async def list_issue_dependencies_for_repositories(
        self,
        session: AsyncSession,
        repos: Sequence[Repository],
    ) -> Sequence[IssueDependency]:
        """
        Returns a dict of issue_id -> list of issues dependent on that issue
        """
        stmt = (
            sql.select(IssueDependency)
            .where(IssueDependency.repository_id.in_(list({r.id for r in repos})))
            .options(
                joinedload(IssueDependency.dependent_issue),
                joinedload(IssueDependency.dependency_issue),
            )
        )
        res = await session.execute(stmt)
        deps = res.scalars().unique().all()
        return deps

    async def update_issue_reference_state(
        self,
        session: AsyncSession,
        issue: Issue,
    ) -> None:
        refs = await self.list_issue_references(session, issue)

        in_progress = False
        pull_request = False

        for r in refs:
            if r.pull_request and not r.pull_request.is_draft:
                pull_request = True
            else:
                in_progress = True

        stmt = (
            sql.update(Issue)
            .where(Issue.id == issue.id)
            .values(
                issue_has_in_progress_relationship=in_progress,
                issue_has_pull_request_relationship=pull_request,
            )
        )

        await session.execute(stmt)
        await session.commit()

    async def mark_confirmed_solved(
        self,
        session: AsyncSession,
        issue_id: UUID,
        by_user_id: UUID,
    ) -> None:
        stmt = (
            sql.update(Issue)
            .where(Issue.id == issue_id, Issue.confirmed_solved_at.is_(None))
            .values(
                confirmed_solved_at=utc_now(),
                confirmed_solved_by=by_user_id,
                needs_confirmation_solved=False,
            )
        )

        await session.execute(stmt)
        await session.commit()

    async def mark_needs_confirmation(
        self, session: AsyncSession, issue_id: UUID
    ) -> bool:
        issue = await self.get(session, issue_id)
        if not issue:
            return False

        # issue needs to be closed
        if issue.state != Issue.State.CLOSED:
            return False

        # Already marked as needs solving or confirmed solved
        if issue.needs_confirmation_solved:
            return False
        if issue.confirmed_solved_at:
            return False

        stmt = (
            sql.update(Issue)
            .where(Issue.id == issue_id)
            .values(needs_confirmation_solved=True)
        )

        await session.execute(stmt)
        await session.commit()

        return True

    async def mark_not_needs_confirmation(
        self, session: AsyncSession, issue_id: UUID
    ) -> bool:
        issue = await self.get(session, issue_id)
        if not issue:
            return False

        # Already marked as solved, do not go back to needs confirmation
        if issue.confirmed_solved_at:
            return False

        stmt = (
            sql.update(Issue)
            .where(Issue.id == issue_id)
            .values(needs_confirmation_solved=False)
        )

        await session.execute(stmt)
        await session.commit()

        return True

    async def transfer(
        self, session: AsyncSession, old_issue: Issue, new_issue: Issue
    ) -> Issue:
        """
        Transfer meaningful properties and linked objects from an issue to another.

        Useful to handle GitHub issues transfer,
        because it creates a new issue and deletes the old one.
        """
        for property in Issue.TRANSFERRABLE_PROPERTIES:
            value = getattr(old_issue, property)
            setattr(new_issue, property, value)
        await new_issue.save(session, autocommit=False)

        # Transfer Pledges
        statement = (
            sql.update(Pledge)
            .where(Pledge.issue_id == old_issue.id)
            .values(
                issue_id=new_issue.id,
                repository_id=new_issue.repository_id,
                organization_id=new_issue.organization_id,
            )
        )
        await session.execute(statement)

        # Transfer IssueReward and Notification
        for model in {IssueReward, Notification}:
            statement = (
                sql.update(model)
                .where(model.issue_id == old_issue.id)  # type: ignore
                .values(issue_id=new_issue.id)
            )
            await session.execute(statement)

        await session.commit()

        return new_issue


issue = IssueService(Issue)
