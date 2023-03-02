from __future__ import annotations

import uuid
from typing import Any, Sequence

import structlog
from sqlalchemy.orm import MappedColumn

from polar.actions.base import Action
from polar.clients import github
from polar.exceptions import ExpectedIssueGotPullRequest
from polar.ext.sqlalchemy.types import GUID
from polar.models.issue import Issue
from polar.platforms import Platforms
from polar.postgres import AsyncSession, sql
from polar.schema.issue import CreateIssue, UpdateIssue

log = structlog.get_logger()


class IssueActions(Action[Issue, CreateIssue, UpdateIssue]):
    @property
    def default_upsert_index_elements(self) -> list[MappedColumn[Any]]:
        return [self.model.external_id]

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Issue | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def list_by_repository(
        self, session: AsyncSession, repository_id: GUID
    ) -> Sequence[Issue]:
        statement = sql.select(Issue).where(Issue.repository_id == repository_id)
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues


class GithubIssueActions(IssueActions):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Issue | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def store(
        self,
        session: AsyncSession,
        data: github.rest.Issue | github.webhooks.IssuesOpenedPropIssue,
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> Issue:
        records = await self.store_many(
            session,
            [data],
            organization_id=organization_id,
            repository_id=repository_id,
        )
        if records:
            return records[0]
        return []

    async def store_many(
        self,
        session: AsyncSession,
        data: list[github.rest.Issue | github.webhooks.IssuesOpenedPropIssue],
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> list[Issue]:
        def parse(
            issue: github.rest.Issue | github.webhooks.IssuesOpenedPropIssue,
        ) -> CreateIssue:
            return CreateIssue.from_github(
                issue,
                organization_id=organization_id,
                repository_id=repository_id,
            )

        schemas = []
        for issue in data:
            try:
                create_schema = parse(issue)
            except ExpectedIssueGotPullRequest:
                log.debug("github.issue", error="got pull request", issue=issue)
                continue

            schemas.append(create_schema)

        if not schemas:
            log.warning(
                "github.issue",
                error="no issues to store",
                organization_id=organization_id,
                repository_id=repository_id,
            )
            return []

        return await self.upsert_many(
            session, schemas, index_elements=[Issue.external_id]
        )


issue = IssueActions(Issue)
github_issue = GithubIssueActions(Issue)
