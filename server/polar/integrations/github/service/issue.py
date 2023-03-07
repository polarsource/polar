from __future__ import annotations

import uuid

import structlog

from polar.exceptions import ExpectedIssueGotPullRequest
from polar.integrations.github import client as github
from polar.issue.schemas import IssueCreate
from polar.issue.service import IssueService
from polar.models.issue import Issue
from polar.enums import Platforms
from polar.postgres import AsyncSession

log = structlog.get_logger()


class GithubIssueService(IssueService):
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
        ) -> IssueCreate:
            return IssueCreate.from_github(
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

        return await self.upsert_many(session, schemas, constraints=[Issue.external_id])


github_issue = GithubIssueService(Issue)
