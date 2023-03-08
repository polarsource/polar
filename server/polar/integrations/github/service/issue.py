from __future__ import annotations


import structlog

from polar.issue.schemas import IssueCreate
from polar.issue.service import IssueService
from polar.models import Issue, Organization, Repository
from polar.enums import Platforms
from polar.postgres import AsyncSession

from ..types import GithubIssue

log = structlog.get_logger()


class GithubIssueService(IssueService):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Issue | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def store(
        self,
        session: AsyncSession,
        *,
        data: GithubIssue,
        organization: Organization,
        repository: Repository,
    ) -> Issue:
        records = await self.store_many(
            session,
            data=[data],
            organization=organization,
            repository=repository,
        )
        return records[0]

    async def store_many(
        self,
        session: AsyncSession,
        *,
        data: list[GithubIssue],
        organization: Organization,
        repository: Repository,
    ) -> list[Issue]:
        def parse(
            issue: GithubIssue,
        ) -> IssueCreate:
            return IssueCreate.from_github(
                issue,
                organization_id=organization.id,
                repository_id=repository.id,
            )

        schemas = [parse(issue) for issue in data]
        if not schemas:
            log.warning(
                "github.issue",
                error="no issues to store",
                organization_id=organization.id,
                repository_id=repository.id,
            )
            return []

        return await self.upsert_many(session, schemas, constraints=[Issue.external_id])


github_issue = GithubIssueService(Issue)
