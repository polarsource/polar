from __future__ import annotations

import asyncio
import datetime
from collections.abc import Awaitable, Sequence
from typing import Any, Literal
from uuid import UUID

import structlog
from githubkit import GitHub, Paginator
from githubkit.exception import RequestFailed
from sqlalchemy import asc, or_

from polar.dashboard.schemas import IssueSortBy
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound
from polar.integrations.loops.service import loops as loops_service
from polar.issue.hooks import IssueHook, issue_upserted
from polar.issue.schemas import IssueCreate, IssueUpdate
from polar.issue.service import IssueService
from polar.kit.db.postgres import (
    AsyncSession,
)
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Issue, Organization, Repository
from polar.models.user import User
from polar.postgres import AsyncSessionMaker
from polar.redis import redis
from polar.repository.hooks import (
    repository_issue_synced,
    repository_issues_sync_completed,
)

from .. import client as github
from .. import types
from ..badge import GithubBadge
from .organization import github_organization
from .paginated import ErrorCount, SyncedCount, github_paginated_service
from .repository import github_repository

log: Logger = structlog.get_logger()


class GithubIssueService(IssueService):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Issue | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def store(
        self,
        session: AsyncSession,
        *,
        data: types.WebhookIssuesOpenedPropIssue
        | types.WebhookIssuesEditedPropIssue
        | types.WebhookIssuesClosedPropIssue
        | types.WebhookIssuesReopenedPropIssue
        | types.WebhookIssuesDeletedPropIssue
        | types.Issue,
        organization: Organization,
        repository: Repository,
        autocommit: bool = True,
    ) -> Issue:
        records = await self.store_many(
            session,
            data=[data],
            organization=organization,
            repository=repository,
            autocommit=autocommit,
        )
        return records[0]

    async def store_many(
        self,
        session: AsyncSession,
        *,
        data: list[
            types.WebhookIssuesOpenedPropIssue
            | types.WebhookIssuesEditedPropIssue
            | types.WebhookIssuesClosedPropIssue
            | types.WebhookIssuesReopenedPropIssue
            | types.WebhookIssuesDeletedPropIssue
            | types.Issue,
        ],
        organization: Organization,
        repository: Repository,
        autocommit: bool = True,
    ) -> Sequence[Issue]:
        def parse(
            issue: types.WebhookIssuesOpenedPropIssue
            | types.WebhookIssuesEditedPropIssue
            | types.WebhookIssuesClosedPropIssue
            | types.WebhookIssuesReopenedPropIssue
            | types.WebhookIssuesDeletedPropIssue
            | types.Issue,
        ) -> IssueCreate:
            return IssueCreate.from_github(issue, organization, repository)

        def filter(
            issue: types.WebhookIssuesOpenedPropIssue
            | types.WebhookIssuesEditedPropIssue
            | types.WebhookIssuesClosedPropIssue
            | types.WebhookIssuesReopenedPropIssue
            | types.WebhookIssuesDeletedPropIssue
            | types.Issue,
        ) -> bool:
            if issue.pull_request:
                log.error(
                    "refusing to save a pull_request as issue",
                    external_id=issue.id,
                )
                return False

            return True

        # Filter out pull requests and log as errors
        data = [d for d in data if filter(d)]

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
            session,
            schemas,
            constraints=[Issue.external_id],
            mutable_keys=IssueCreate.__mutable_keys__,
            autocommit=autocommit,
        )

        # We're currently in a bit of a pickle here.
        #
        # We're propagating the session to the hook functions, and they are unable
        # to know wether or not we're supposed to commit or not.
        #
        # The workaround is to skip calling hooks if autocommit is disabled.
        # Today (2023-09-14) this only affects issues/for_you.
        #
        # TODO: migrate away from this hook!
        if autocommit:
            for record in records:
                await issue_upserted.call(IssueHook(session, record))

        return records

    async def set_issue_badge_custom_message(
        self, session: AsyncSession, issue: Issue, message: str
    ) -> Issue:
        stmt = (
            sql.update(Issue)
            .where(Issue.id == issue.id)
            .values(badge_custom_content=message)
        )
        await session.execute(stmt)
        await session.commit()

        # update the in memory version as well
        issue.badge_custom_content = message
        return issue

    async def embed_badge(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        repository: Repository,
        issue: Issue,
        triggered_from_label: bool,
    ) -> bool:
        (should, reason) = GithubBadge.should_add_badge(
            organization=organization,
            repository=repository,
            issue=issue,
            triggered_from_label=triggered_from_label,
        )
        if not should:
            log.info(
                "github.issue.badge",
                embedded=False,
                reason=reason,
                issue_id=issue.id,
            )
            return False

        badge = GithubBadge(
            organization=organization, repository=repository, issue=issue
        )
        await badge.embed()

        stmt = (
            sql.update(Issue)
            .values(
                pledge_badge_embedded_at=utc_now(),
                pledge_badge_ever_embedded=True,
            )
            .where(Issue.id == issue.id)
        )
        await session.execute(stmt)
        await session.commit()

        await loops_service.issue_badged(session, issue=issue)

        return True

    async def remove_badge(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        repository: Repository,
        issue: Issue,
        triggered_from_label: bool,
    ) -> bool:
        (should, reason) = GithubBadge.should_remove_badge(
            organization=organization,
            repository=repository,
            issue=issue,
            triggered_from_label=triggered_from_label,
        )
        if not should:
            log.info(
                "github.issue.badge",
                embedded=False,
                reason=reason,
                issue_id=issue.id,
            )
            return False

        badge = GithubBadge(
            organization=organization, repository=repository, issue=issue
        )
        # TODO: Abort unless not successful
        await badge.remove()

        stmt = (
            sql.update(Issue)
            .values(
                pledge_badge_embedded_at=None,
                pledge_badge_ever_embedded=True,
            )
            .where(Issue.id == issue.id)
        )
        await session.execute(stmt)
        await session.commit()

        # TODO: Return True instead to reflect update.
        # Just need to write & perform tests before changing.
        return False

    async def update_embed_badge(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        repository: Repository,
        issue: Issue,
    ) -> bool:
        if not issue.pledge_badge_currently_embedded:
            log.info(
                "github.badge.update_embed_badge",
                error="badge is currently not embedded, continue",
                issue_id=issue.id,
            )
            return False

        badge = GithubBadge(
            organization=organization, repository=repository, issue=issue
        )
        await badge.embed()

        stmt = (
            sql.update(Issue)
            .values(
                pledge_badge_embedded_at=utc_now(),
                pledge_badge_ever_embedded=True,
            )
            .where(Issue.id == issue.id)
        )
        await session.execute(stmt)
        await session.commit()

        return True

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
            else org.safe_installation_id
        )

        client = github.get_app_installation_client(installation_id)

        log.info("github.sync_issue", issue_id=issue.id)

        try:
            res = await client.rest.issues.async_get(
                org.name,
                repo=repo.name,
                issue_number=issue.number,
                headers={"If-None-Match": issue.github_issue_etag}
                if issue.github_issue_etag
                else {},
            )
        except RequestFailed as e:
            if e.response.status_code == 404:
                log.info("github.sync_issue.404.marking_as_crawled")
                issue.github_issue_fetched_at = utc_now()
                session.add(issue)
            elif e.response.status_code == 410:  # 410 Gone, i.e. deleted
                log.info("github.sync_issue.410.soft_deleting")
                await self.soft_delete(session, issue.id)
                return
            else:
                raise e

        # Cache hit, nothing new
        if res.status_code == 304:
            log.info("github.sync_issue.etag_cache_hit", issue_id=issue.id)
            return

        if res.status_code == 200:
            log.info("github.sync_issue.etag_cache_miss", issue_id=issue.id)

            do_upsert = True

            # This happens when a repository has been moved from one repository to
            # another repo. The old URL and ID will redirect to issue in the new
            # repository, but with the response changed. A real-life example of this is
            # https://www.github.com/litestar-org/litestar/issues/2027 which has been
            # moved to https://github.com/litestar-org/litestar.dev/issues/8. To avoid
            # confusion between litestar.dev#8 and litestar#8, abort here and do not
            # save the new version.
            #
            # A potential improvement here is to mark the issue as deleted?
            if (
                res.parsed_data.repository
                and res.parsed_data.repository.id != repo.external_id
            ):
                log.info(
                    "github.sync_issue.repository_changed_skipping",
                    expected_repo_id=repo.external_id,
                    got_repo_id=res.parsed_data.repository.id,
                )
                do_upsert = False

            # Same as above, but checking for issue number changes
            if res.parsed_data.number != issue.number:
                log.info(
                    "github.sync_issue.number_changed_skipping",
                    expected_issue_number=issue.number,
                    got_issue_number=res.parsed_data.number,
                )
                do_upsert = False

            if do_upsert:
                await self.store(
                    session, data=res.parsed_data, organization=org, repository=repo
                )

            # Save etag
            issue.github_issue_fetched_at = utc_now()
            issue.github_issue_etag = res.headers.get("etag", None)
            session.add(issue)

    async def list_issues_to_crawl_issue(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Sequence[Issue]:
        current_time = utc_now()
        cutoff_time = current_time - datetime.timedelta(hours=12)

        stmt = (
            sql.select(Issue)
            .join(Issue.organization)
            .join(Issue.repository)
            .where(
                or_(
                    Issue.github_issue_fetched_at.is_(None),
                    Issue.github_issue_fetched_at < cutoff_time,
                ),
                Issue.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
                Repository.deleted_at.is_(None),
                Organization.installation_id.is_not(None),
                Organization.id == organization.id,
            )
            .order_by(asc(Issue.github_issue_fetched_at))
            .limit(100)
        )

        res = await session.execute(stmt)

        return res.scalars().unique().all()

    async def list_issues_to_crawl_timeline(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Sequence[Issue]:
        current_time = utc_now()
        cutoff_time = current_time - datetime.timedelta(hours=12)

        stmt = (
            sql.select(Issue)
            .join(Issue.organization)
            .join(Issue.repository)
            .where(
                or_(
                    Issue.github_timeline_fetched_at.is_(None),
                    Issue.github_timeline_fetched_at < cutoff_time,
                ),
                Issue.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
                Repository.deleted_at.is_(None),
                Organization.installation_id.is_not(None),
                Organization.id == organization.id,
            )
            .order_by(asc(Issue.github_timeline_fetched_at))
            .limit(100)
        )

        res = await session.execute(stmt)

        return res.scalars().unique().all()

    async def list_issues_to_add_badge_to_auto(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
    ) -> Sequence[Issue]:
        (issues, _) = await self.list_by_repository_type_and_status(
            session=session,
            repository_ids=[repository.id],
            sort_by=IssueSortBy.recently_updated,
        )

        def filter(issue: Issue) -> bool:
            (should, _) = GithubBadge.should_add_badge(
                organization=organization,
                repository=repository,
                issue=issue,
                triggered_from_label=False,
            )
            return should

        add_issues = [issue for issue in reversed(issues) if filter(issue)]

        return add_issues

    async def list_issues_to_remove_badge_from_auto(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
    ) -> Sequence[Issue]:
        (issues, _) = await self.list_by_repository_type_and_status(
            session=session,
            repository_ids=[repository.id],
            sort_by=IssueSortBy.recently_updated,
        )

        def filter(issue: Issue) -> bool:
            (should, _) = GithubBadge.should_remove_badge(
                organization=organization,
                repository=repository,
                issue=issue,
                triggered_from_label=False,
            )
            return should

        remove_issues = [issue for issue in reversed(issues) if filter(issue)]

        return remove_issues

    async def set_labels(
        self,
        session: AsyncSession,
        issue: Issue,
        repository: Repository,
        github_labels: list[types.Label]
        | list[types.WebhookIssuesLabeledPropIssuePropLabelsItems]
        | list[types.WebhookIssuesUnlabeledPropIssuePropLabelsItems],
    ) -> Issue:
        labels = [label.model_dump(mode="json") for label in github_labels]
        issue.labels = labels
        issue.has_pledge_badge_label = Issue.contains_pledge_badge_label(
            labels, repository.pledge_badge_label
        )
        session.add(issue)
        await session.commit()

        return issue

    async def add_polar_label(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        issue: Issue,
    ) -> Issue:
        client = github.get_app_installation_client(organization.safe_installation_id)

        labels = await client.rest.issues.async_add_labels(
            organization.name,
            repository.name,
            issue.number,
            data=[repository.pledge_badge_label],
        )

        issue = await self.set_labels(session, issue, repository, labels.parsed_data)

        return issue

    async def remove_polar_label(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        issue: Issue,
    ) -> Issue:
        client = github.get_app_installation_client(organization.safe_installation_id)

        labels = await client.rest.issues.async_remove_label(
            organization.name,
            repository.name,
            issue.number,
            repository.pledge_badge_label,
        )

        issue = await self.set_labels(session, issue, repository, labels.parsed_data)

        return issue

    async def add_comment_as_user(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        issue: Issue,
        user: User,
        comment: str,
    ) -> None:
        client = await github.get_user_client(session, user)

        await client.rest.issues.async_create_comment(
            organization.name,
            repository.name,
            issue.number,
            body=comment,
        )

    async def sync_external_org_with_repo_and_issue(
        self,
        session: AsyncSession,
        *,
        client: GitHub[Any],
        org_name: str,
        repo_name: str,
        issue_number: int,
    ) -> Issue:
        log.info(
            "syncing external issue",
            org_name=org_name,
            repo_name=repo_name,
            issue_number=issue_number,
        )

        issue = await self.get_by_external_lookup_key(
            session, Platforms.github, f"{org_name}/{repo_name}/{issue_number}"
        )
        if issue is not None:
            log.debug(
                "external issue found by lookup key",
                org_name=org_name,
                repo_name=repo_name,
                issue_number=issue_number,
                external_id=issue.external_id,
            )
            return issue

        try:
            github_repository_response = await client.rest.repos.async_get(
                org_name, repo_name
            )
        except RequestFailed as e:
            if e.response.status_code in [404, 401]:
                raise ResourceNotFound()
            raise e

        github_repository_data = github_repository_response.parsed_data

        organization = await github_organization.create_or_update_from_github(
            session, github_repository_data.owner
        )

        repository = await github_repository.create_or_update_from_github(
            session, organization, github_repository_data
        )

        try:
            issue_response = await client.rest.issues.async_get(
                organization.name, repository.name, issue_number
            )
        except RequestFailed as e:
            if e.response.status_code in [404, 401]:
                raise ResourceNotFound()
            raise e

        github_issue_data = issue_response.parsed_data

        if github_issue_data.pull_request:
            log.info(
                "issue is pull request, skipping",
                org_name=org_name,
                repo_name=repo_name,
                issue_number=issue_number,
                external_id=github_issue_data.id,
            )
            raise ResourceNotFound()

        return await self.create_or_update_from_github(
            session, organization, repository, github_issue_data
        )

    async def sync_issues(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        repository: Repository,
        state: Literal["open", "closed", "all"] = "open",
        sort: Literal["created", "updated", "comments"] = "updated",
        direction: Literal["asc", "desc"] = "desc",
        per_page: int = 30,
        crawl_with_installation_id: int
        | None = None,  # Override which installation to use when crawling
    ) -> tuple[SyncedCount, ErrorCount]:
        # We get PRs in the issues list too, but super slim versions of them.
        # Since we sync PRs separately, we therefore skip them here.
        def skip_if_pr(
            data: types.Issue | types.PullRequestSimple,
        ) -> bool:
            if isinstance(data, types.PullRequestSimple):
                return True
            if data.pull_request:
                return True
            return False

        installation_id = (
            crawl_with_installation_id
            if crawl_with_installation_id
            else organization.safe_installation_id
        )

        client = github.get_app_installation_client(installation_id)

        paginator: Paginator[types.Issue] = client.paginate(
            client.rest.issues.async_list_for_repo,
            owner=organization.name,
            repo=repository.name,
            state=state,
            sort=sort,
            direction=direction,
            per_page=per_page,
        )
        synced, errors = await github_paginated_service.store_paginated_resource(
            session,
            paginator=paginator,
            store_resource_method=github_issue.store,
            organization=organization,
            repository=repository,
            skip_condition=skip_if_pr,
            on_sync_signal=repository_issue_synced,
            on_completed_signal=repository_issues_sync_completed,
            resource_type="issue",
        )
        return (synced, errors)

    async def list_issues_from_starred(
        self,
        session: AsyncSession,
        sessionmaker: AsyncSessionMaker,
        user: User,
    ) -> list[Issue]:
        # use cached result if we have one
        cache_key = "recommendations:" + str(user.id)
        val = await redis.lrange(cache_key, 0, -1)
        if val:
            res_issues: list[Issue] = []
            for id in val:
                issue = await github_issue.get(session, UUID(id))
                if issue:
                    res_issues.append(issue)
            return res_issues

        client = await github.get_user_client(session, user)

        # get the latest starred repos
        starred = (
            await client.rest.activity.async_list_repos_starred_by_authenticated_user(
                per_page=15
            )
        )

        # concurrently crawl each repository
        jobs: list[Awaitable[list[Issue]]] = []

        self_github_username = user.github_username

        for r in starred.parsed_data:
            # skip self owned repos
            if r.owner.login == self_github_username:
                continue
            if r.private:
                continue

            jobs.append(recommended_in_repo(sessionmaker, r, client))

        # collect the results from each coroutine
        results: list[list[Issue]] = await asyncio.gather(*jobs)
        await session.commit()
        res = [i for sub in results for i in sub]

        # No recommendations, nothing to cache!
        if len(res) == 0:
            return []

        # set cache
        async with redis.pipeline() as pipe:
            pipe.delete(cache_key)
            pipe.rpush(cache_key, *[str(i.id) for i in res])
            pipe.expire(cache_key, datetime.timedelta(hours=24))
            await pipe.execute()

        return res

    async def create_or_update_from_github(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        data: types.Issue | types.WebhookIssuesTransferredPropChangesPropNewIssue,
    ) -> Issue:
        issue = await self.get_by_external_id(session, data.id)

        if not issue:
            log.debug(
                "issue not found by external_id, creating it",
                external_id=data.id,
            )
            issue = await self.create(
                session, IssueCreate.from_github(data, organization, repository)
            )
        else:
            log.debug(
                "issue found by external_id, updating it",
                external_id=data.id,
            )
            issue = await self.update(
                session,
                issue,
                IssueUpdate.from_github(data, organization, repository),
                exclude_unset=True,
            )

        return issue


async def recommended_in_repo(
    sessionmaker: AsyncSessionMaker, r: types.Repository, client: GitHub[Any]
) -> list[Issue]:
    # this job runs in it's own thread/job, making sure to create our own db session
    async with sessionmaker() as session:
        org = await github_organization.create_or_update_from_github(session, r.owner)

        repo = await github_repository.create_or_update_from_github(
            session,
            org,
            r,
        )

        issues = await client.rest.issues.async_list_for_repo(
            org.name,
            repo.name,
            state="open",
            per_page=10,
            sort="comments",
            direction="desc",
        )

        found = 0

        by_thumbs_up = sorted(
            issues.parsed_data,
            key=lambda i: i.reactions.plus_one if i.reactions else 0,
            reverse=True,
        )

        res: list[Issue] = []

        for i in by_thumbs_up:
            if i.pull_request:
                continue

            # max 4 per repo
            if found > 3:
                return res

            found += 1

            issue = await github_issue.store(
                session,
                data=i,
                organization=org,
                repository=repo,
                # disable autocommit to also disable downstream hooks
                autocommit=False,
            )

            res.append(issue)

        # commit and cleanup session
        await session.commit()
        await session.close()

    return res


github_issue = GithubIssueService(Issue)
