from __future__ import annotations
import datetime

from typing import Sequence, Union
from githubkit import GitHub, Response
from githubkit.rest.models import Issue as GitHubIssue
from githubkit.exception import RequestFailed
from sqlalchemy import asc, or_

import structlog
from polar.context import PolarContext
from polar.kit.extensions.sqlalchemy import sql

from polar.kit.utils import utc_now
from polar.issue.schemas import IssueCreate
from polar.issue.service import IssueService
from polar.models import Issue, Organization, Repository
from polar.enums import Platforms
from polar.postgres import AsyncSession
from polar.integrations.github import client as github
from polar.integrations.github.service.api import github_api


from ..types import GithubIssue
from ..badge import GithubBadge
from ..signals import github_issue_created, github_issue_updated
from ..exceptions import (
    GithubBadgeNotEmbeddable,
    GithubBadgeAlreadyEmbedded,
    GithubBadgeEmbeddingDisabled,
    GithubBadgeNotEmbedded,
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
                PolarContext(),
                session=session,
                organization=organization,
                repository=repository,
                issue=record,
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
            issue.pledge_badge_embedded_at = utc_now()
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

    async def remove_badge(
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
            await badge.remove()
            # Why only save the timestamp vs. updated body/issue?
            # There's a race condition here since we updated the issue and it will
            # trigger a webhook upon which we'll update the entire issue except for this
            # timestamp. So we leave the updating of the issue to our webhook handler.
            issue.pledge_badge_embedded_at = None
            await issue.save(session)
            return True
        except GithubBadgeNotEmbedded:
            log.info(
                "github.issue.remove_badge",
                embedded=False,
                reason="not_embedded",
                issue_id=issue.id,
            )
        return False

    # client.rest.issues_async_get
    async def async_issues_get_with_headers(
        self,
        client: GitHub,
        owner: str,
        repo: str,
        issue_number: int,
        etag: str | None = None,
    ) -> Response[GitHubIssue]:
        url = f"/repos/{owner}/{repo}/issues/{issue_number}"

        return await github_api.async_request_with_headers(
            client=client,
            url=url,
            etag=etag,
            response_model=GitHubIssue,
        )

    async def sync_issue(
        self,
        session: AsyncSession,
        org: Organization,
        repo: Repository,
        issue: Issue,
        crawl_with_installation_id: int
        | None = None,  # Override which installation to use when crawling
    ) -> None:

        installation_id = (
            crawl_with_installation_id
            if crawl_with_installation_id
            else org.installation_id
        )

        if not installation_id:
            raise Exception("no github installation id found")

        client = github.get_app_installation_client(installation_id)

        log.info("github.sync_issue", issue_id=issue.id)

        try:
            res = await self.async_issues_get_with_headers(
                client,
                owner=org.name,
                repo=repo.name,
                issue_number=issue.number,
                etag=issue.github_issue_etag,
            )
        except RequestFailed as e:
            if e.response.status_code == 404:
                issue.github_issue_fetched_at = datetime.datetime.utcnow()
                await issue.save(session)
                log.info("github.sync_issue.404.marking_as_crawled")
                return
            else:
                raise e

        # Cache hit, nothing new
        if res.status_code == 304:
            log.info(
                "github.sync_issue.etag_cache_hit", issue_id=issue.id
            )
            return

        if res.status_code == 200:
            log.info(
                "github.sync_issue.etag_cache_miss", issue_id=issue.id
            )

            # Upsert issue
            await self.store(
                session, data=res.parsed_data, organization=org, repository=repo
            )

            # Save etag
            issue.github_issue_fetched_at = datetime.datetime.utcnow()
            issue.github_issue_etag = res.headers.get("etag", None)
            await issue.save(session)

    async def list_issues_to_crawl_issue(
        self,
        session: AsyncSession,
    ) -> Sequence[Issue]:
        current_time = datetime.datetime.utcnow()
        one_hour_ago = current_time - datetime.timedelta(hours=1)

        stmt = (
            sql.select(Issue)
            .join(Issue.organization)
            .join(Issue.repository)
            .where(
                or_(
                    Issue.github_issue_fetched_at.is_(None),
                    Issue.github_issue_fetched_at < one_hour_ago,
                ),
                Issue.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
                Repository.deleted_at.is_(None),
                Organization.installation_id.is_not(None),
            )
            .order_by(asc(Issue.github_issue_fetched_at))
            .limit(1000)
        )

        res = await session.execute(stmt)

        return res.scalars().unique().all()

    async def list_issues_to_crawl_timeline(
        self,
        session: AsyncSession,
    ) -> Sequence[Issue]:
        current_time = datetime.datetime.utcnow()
        one_hour_ago = current_time - datetime.timedelta(hours=1)

        stmt = (
            sql.select(Issue)
            .join(Issue.organization)
            .join(Issue.repository)
            .where(
                or_(
                    Issue.github_timeline_fetched_at.is_(None),
                    Issue.github_timeline_fetched_at < one_hour_ago,
                ),
                Issue.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
                Repository.deleted_at.is_(None),
                Organization.installation_id.is_not(None),
            )
            .order_by(asc(Issue.github_timeline_fetched_at))
            .limit(1000)
        )

        res = await session.execute(stmt)

        return res.scalars().unique().all()


github_issue = GithubIssueService(Issue)
