from __future__ import annotations

from uuid import UUID
from typing import List, Sequence, Tuple
from sqlalchemy import Select, desc, func, or_

import structlog
from sqlalchemy.orm import InstrumentedAttribute
from polar.dashboard.schemas import IssueListType

from polar.kit.services import ResourceService
from polar.models.issue import Issue
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
        # platform: Platforms,
        # organization_id: UUID,
        # repository_id: UUID,
        id: UUID,
    ) -> Issue | None:
        return await self.get_by(
            session,
            # platform=platform,
            # organization_id=organization_id,
            # repository_id=repository_id,
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

    async def list_by_repository_type_and_status(
        self,
        session: AsyncSession,
        repository_ids: List[UUID],
        issue_list_type: IssueListType,
        text: str | None = None,
        include_open: bool = True,
        include_closed: bool = False,
        sort_by_newest: bool = False,
        sort_by_relevance: bool = False,
    ) -> Sequence[Issue]:
        statement: Select[Tuple[Issue]] | None = None

        if issue_list_type == IssueListType.issues:
            statement = sql.select(Issue).where(Issue.repository_id.in_(repository_ids))
        elif issue_list_type == IssueListType.following:
            statement = (
                sql.select(Issue)
                .join(
                    IssueDependency,
                    IssueDependency.dependency_issue_id == Issue.id,
                )
                .where(IssueDependency.repository_id.in_(repository_ids))
            )
        else:
            raise ValueError(f"Unknown issue list type: {issue_list_type}")

        filters = []
        if include_open:
            filters.append(Issue.issue_closed_at.is_(None))
        if include_closed:
            filters.append(Issue.issue_closed_at.is_not(None))

        statement = statement.where(or_(*filters))

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
            .join(
                PullRequest,
                IssueReference.pull_request_id == PullRequest.id,
                isouter=True,
            )
            .where(
                IssueReference.issue_id == issue.id,
            )
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
            .join(
                Issue,
                IssueDependency.dependent_issue_id == Issue.id,
            )
            .where(
                IssueDependency.repository_id.in_([r.id for r in repos]),
            )
        )
        res = await session.execute(stmt)
        deps = res.scalars().unique().all()
        return deps


issue = IssueService(Issue)
