from __future__ import annotations
from typing import Sequence, Union

import structlog

from polar.kit.utils import utc_now
from polar.issue.schemas import IssueCreate
from polar.issue.service import IssueService
from polar.models import Issue, Organization, Repository
from polar.enums import Platforms
from polar.postgres import AsyncSession
from polar.integrations.github import client as github


from ..types import GithubIssue
from ..badge import GithubBadge
from ..signals import github_issue_created, github_issue_updated
from ..exceptions import (
    GithubBadgeNotEmbeddable,
    GithubBadgeAlreadyEmbedded,
    GithubBadgeEmbeddingDisabled,
)

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
        data: Union[
            GithubIssue,  # TODO: remove nested union
            github.webhooks.IssuesOpenedPropIssue,
            github.webhooks.IssuesClosedPropIssue,
            github.webhooks.Issue,
        ],
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
        data: list[
            Union[
                GithubIssue,  # TODO: remove nested union
                github.webhooks.IssuesOpenedPropIssue,
                github.webhooks.IssuesClosedPropIssue,
                github.webhooks.Issue,
            ],
        ],
        organization: Organization,
        repository: Repository,
    ) -> Sequence[Issue]:
        def parse(
            issue: Union[
                GithubIssue,  # TODO: remove nested union
                github.webhooks.IssuesOpenedPropIssue,
                github.webhooks.IssuesClosedPropIssue,
                github.webhooks.Issue,
            ],
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

        records = await self.upsert_many(
            session, schemas, constraints=[Issue.external_id]
        )
        for record in records:
            signal = github_issue_updated
            if record.was_created:
                signal = github_issue_created

            await signal.send_async(
                session, organization=organization, repository=repository, issue=record
            )

        return records

    async def embed_badge(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        repository: Repository,
        issue: Issue,
    ) -> bool:
        try:
            badge = GithubBadge(
                organization=organization, repository=repository, issue=issue
            )
            await badge.embed()
            # Why only save the timestamp vs. updated body/issue?
            # There's a race condition here since we updated the issue and it will
            # trigger a webhook upon which we'll update the entire issue except for this
            # timestamp. So we leave the updating of the issue to our webhook handler.
            issue.funding_badge_embedded_at = utc_now()
            await issue.save(session)
            return True
        except GithubBadgeNotEmbeddable as e:
            log.info(
                "github.issue.badge",
                embedded=False,
                reason=str(e),
                issue_id=issue.id,
            )
        except GithubBadgeAlreadyEmbedded:
            log.info(
                "github.issue.badge",
                embedded=False,
                reason="already_embedded",
                issue_id=issue.id,
            )
        except GithubBadgeEmbeddingDisabled:
            log.info(
                "github.issue.badge",
                embedded=False,
                reason="embed_disabled",
                issue_id=issue.id,
            )

        return False


github_issue = GithubIssueService(Issue)
