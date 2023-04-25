from __future__ import annotations

from uuid import UUID
from typing import List, Literal, Sequence, Tuple
from sqlalchemy import Select, desc, func, or_, ColumnElement
from sqlalchemy.orm import joinedload
import structlog
from sqlalchemy.orm import InstrumentedAttribute
from polar.dashboard.schemas import IssueListType

from polar.kit.services import ResourceService
from polar.models.issue import Issue
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.enums import Platforms
from polar.models.issue_dependency import IssueDependency
from polar.models.issue_reference import IssueReference
from polar.models.pull_request import PullRequest
from polar.postgres import AsyncSession, sql

from .schemas import IssueCreate, IssueUpdate


log = structlog.get_logger()


class IssueService(ResourceService[Issue, IssueCreate, IssueUpdate]):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
        return [self.model.external_id]

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Issue | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def get_by_id(
        self,
        session: AsyncSession,
        id: UUID,
    ) -> Issue | None:
        return await self.get_by(
            session,
            id=id,
        )

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

    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[Issue]:
        statement = sql.select(Issue).where(Issue.repository_id == repository_id)
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def list_by_repository_and_numbers(
        self, session: AsyncSession, repository_id: UUID, numbers: List[int]
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
        repository_ids: List[UUID],
        issue_list_type: IssueListType,
        text: str | None = None,
        include_open: bool = True,
        include_closed: bool = False,
        sort_by_newest: bool = False,
        sort_by_recently_updated: bool = False,
        sort_by_relevance: bool = False,
        pledged_by_org: UUID
        | None = None,  # Only include issues that have been pledged by this org
        pledged_by_user: UUID
        | None = None,  # Only include issues that have been pledged by this user
        have_pledge: bool | None = None,  # If issues have pledge or not
    ) -> Sequence[Issue]:
        statement = sql.select(Issue).join(
            Pledge, Pledge.issue_id == Issue.id, isouter=True
        )

        if issue_list_type == IssueListType.issues:
            statement = statement.where(Issue.repository_id.in_(repository_ids))
        elif issue_list_type == IssueListType.dependencies:
            if not pledged_by_org and not pledged_by_user:
                raise ValueError("no pledge_by criteria specified")

            pledge_criterias: list[ColumnElement[bool]] = []
            if pledged_by_org:
                pledge_criterias.append(Pledge.by_organization_id == pledged_by_org)

            if pledged_by_user:
                pledge_criterias.append(Pledge.by_user_id == pledged_by_user)

            statement = statement.join(
                IssueDependency,
                IssueDependency.dependency_issue_id == Issue.id,
                isouter=True,
            ).where(
                or_(
                    IssueDependency.repository_id.in_(repository_ids),
                    or_(*pledge_criterias),
                )
            )

        else:
            raise ValueError(f"Unknown issue list type: {issue_list_type}")

        filters = []
        if include_open:
            filters.append(Issue.issue_closed_at.is_(None))
        if include_closed:
            filters.append(Issue.issue_closed_at.is_not(None))

        statement = statement.where(or_(*filters))

        # pledge filter
        if have_pledge is not None:
            if have_pledge:
                statement = statement.where(Pledge.id.is_not(None))
            else:
                statement = statement.where(Pledge.id.is_(None))

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
            if sort_by_relevance:
                statement = statement.order_by(
                    desc(func.ts_rank_cd(Issue.title_tsv, func.to_tsquery(search)))
                )

        if sort_by_newest:
            statement = statement.order_by(desc(Issue.issue_created_at))
        if sort_by_recently_updated:
            statement = statement.order_by(desc(Issue.issue_modified_at))

        res = await session.execute(statement)
        issues = res.scalars().unique().all()

        return issues

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
            .where(
                IssueDependency.repository_id.in_([r.id for r in repos]),
            )
            .options(
                joinedload(IssueDependency.dependent_issue),
                joinedload(IssueDependency.dependency_issue),
            )
        )
        res = await session.execute(stmt)
        deps = res.scalars().unique().all()
        return deps


issue = IssueService(Issue)
