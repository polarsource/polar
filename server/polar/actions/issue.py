from __future__ import annotations

from typing import Any

import structlog
from sqlalchemy.orm import MappedColumn

from polar.actions.base import Action
from polar.clients import github
from polar.exceptions import ExpectedIssueGotPullRequest
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

    async def get_by_url(
        self, session: AsyncSession, organization_name: str, repo_name: str, number: int
    ) -> Issue | None:
        query = (
            sql.select(Issue)
            .where(
                (Issue.organization_name == organization_name)
                & (Issue.repository_name == repo_name)
                & (Issue.number == number)
            )
            .limit(1)
        )
        return await self.get_by_query(session, query)


class GithubIssueActions(IssueActions):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Issue | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def store(
        self,
        session: AsyncSession,
        organization_name: str,
        repository_name: str,
        data: github.webhooks.IssuesOpenedPropIssue,
        organization_id: str | None = None,
        repository_id: str | None = None,
    ) -> Issue:
        records = await self.store_many(
            session,
            organization_name,
            repository_name,
            [data],
            organization_id=organization_id,
            repository_id=repository_id,
        )
        return records[0]

    async def store_many(
        self,
        session: AsyncSession,
        organization_name: str,
        repository_name: str,
        data: list[github.webhooks.IssuesOpenedPropIssue],
        organization_id: str | None = None,
        repository_id: str | None = None,
    ) -> list[Issue]:
        def parse(issue: github.webhooks.IssuesOpenedPropIssue) -> CreateIssue:
            return CreateIssue.from_github(
                organization_name,
                repository_name,
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

        return await self.upsert_many(
            session, schemas, index_elements=[Issue.external_id]
        )


issue = IssueActions(Issue)
github_issue = GithubIssueActions(Issue)
