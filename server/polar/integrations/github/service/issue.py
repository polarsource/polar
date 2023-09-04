from __future__ import annotations

import datetime
from typing import Any, Literal, Sequence, Tuple, Union

import structlog
from githubkit import GitHub, Response
from githubkit.exception import RequestFailed
from githubkit.rest.models import Issue as GitHubIssue
from githubkit.rest.models import Label
from githubkit.webhooks.models import Label as WebhookLabel
from sqlalchemy import asc, or_

from polar.dashboard.schemas import IssueListType, IssueSortBy
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound
from polar.integrations.github import client as github
from polar.integrations.github.service.api import github_api
from polar.issue.hooks import IssueHook, issue_upserted
from polar.issue.schemas import IssueCreate
from polar.issue.service import IssueService
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.utils import utc_now
from polar.models import Issue, Organization, Repository
from polar.models.user import User
from polar.organization.schemas import OrganizationCreate
from polar.postgres import AsyncSession
from polar.repository.hooks import (
    repository_issue_synced,
    repository_issues_sync_completed,
)
from polar.repository.schemas import RepositoryCreate

from ..badge import GithubBadge
from .organization import github_organization
from .paginated import ErrorCount, SyncedCount, github_paginated_service
from .repository import github_repository

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
            github.webhooks.IssuesOpenedPropIssue,
            github.webhooks.IssuesClosedPropIssue,
            github.webhooks.IssuesReopenedPropIssue,
            github.webhooks.Issue,
            github.rest.Issue,
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
                github.webhooks.IssuesOpenedPropIssue,
                github.webhooks.IssuesClosedPropIssue,
                github.webhooks.IssuesReopenedPropIssue,
                github.webhooks.Issue,
                github.rest.Issue,
            ],
        ],
        organization: Organization,
        repository: Repository,
    ) -> Sequence[Issue]:
        def parse(
            issue: Union[
                github.webhooks.IssuesOpenedPropIssue,
                github.webhooks.IssuesClosedPropIssue,
                github.webhooks.IssuesReopenedPropIssue,
                github.webhooks.Issue,
                github.rest.Issue,
            ],
        ) -> IssueCreate:
            return IssueCreate.from_github(
                issue,
                organization_id=organization.id,
                repository_id=repository.id,
            )

        def filter(
            issue: Union[
                github.webhooks.IssuesOpenedPropIssue,
                github.webhooks.IssuesClosedPropIssue,
                github.webhooks.IssuesReopenedPropIssue,
                github.webhooks.Issue,
                github.rest.Issue,
            ],
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
        )
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
        # TODO: Abort unless not successful
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

    # client.rest.issues_async_get
    async def async_issues_get_with_headers(
        self,
        client: GitHub[Any],
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
                log.info("github.sync_issue.404.marking_as_crawled")
                issue.github_issue_fetched_at = datetime.datetime.utcnow()
                await issue.save(session)
                return
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
            issue.github_issue_fetched_at = datetime.datetime.utcnow()
            issue.github_issue_etag = res.headers.get("etag", None)
            await issue.save(session)

    async def list_issues_to_crawl_issue(
        self,
        session: AsyncSession,
        organization: Organization,
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
            issue_list_type=IssueListType.issues,
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
            issue_list_type=IssueListType.issues,
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
        github_labels: Union[
            list[Label],
            list[WebhookLabel],
        ],
    ) -> Issue:
        labels = github.jsonify(github_labels)
        issue.labels = labels
        issue.has_pledge_badge_label = Issue.contains_pledge_badge_label(labels)
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
        client = github.get_app_installation_client(organization.installation_id)

        labels = await client.rest.issues.async_add_labels(
            organization.name, repository.name, issue.number, data=["polar"]
        )

        issue = await self.set_labels(session, issue, labels.parsed_data)

        return issue

    async def remove_polar_label(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        issue: Issue,
    ) -> Issue:
        client = github.get_app_installation_client(organization.installation_id)

        labels = await client.rest.issues.async_remove_label(
            organization.name, repository.name, issue.number, "polar"
        )

        issue = await self.set_labels(session, issue, labels.parsed_data)

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
    ) -> Tuple[Organization, Repository, Issue]:
        log.info(
            "syncing external",
            org_name=org_name,
            repo_name=repo_name,
            issue_number=issue_number,
        )

        organization = await github_organization.get_by_name(
            session, Platforms.github, org_name
        )

        if not organization:
            log.info("organization not found by name", org_name=org_name)

            try:
                repo_response = await client.rest.repos.async_get(org_name, repo_name)
                github_repo = repo_response.parsed_data
                owner = github_repo.owner
                is_personal = owner.type.lower() == "user"
            except RequestFailed as e:
                if e.response.status_code == 404:
                    raise ResourceNotFound()
                if e.response.status_code == 401:
                    raise ResourceNotFound()
                # re-raise other status codes
                raise e

            # check if we have org with same external_id
            organization = await github_organization.get_by_external_id(
                session, owner.id
            )

        # still no organization, create it
        if not organization:
            log.info(
                "organization not found by external_id, creating it",
                org_name=org_name,
                external_id=owner.id,
            )

            organization = await github_organization.create(
                session,
                OrganizationCreate(
                    platform=Platforms.github,
                    name=owner.login,
                    external_id=owner.id,
                    avatar_url=owner.avatar_url,
                    is_personal=is_personal,
                ),
            )

        repository = await github_repository.get_by_org_and_name(
            session,
            organization.id,
            repo_name,
        )

        if not repository:
            log.info(
                "repository not found by name",
                organization_id=organization.id,
                repo_name=repo_name,
            )

            try:
                repo_response = await client.rest.repos.async_get(org_name, repo_name)
                github_repo = repo_response.parsed_data
            except RequestFailed as e:
                if e.response.status_code == 404:
                    raise ResourceNotFound()
                # re-raise other status codes
                raise e

            # check if we have repo with same external_id
            repository = await github_repository.get_by_external_id(
                session, github_repo.id
            )

        # still no repository
        if not repository:
            log.info(
                "repository not found by external_id, creating it",
                organization_id=organization.id,
                repo_name=repo_name,
                external_id=github_repo.id,
            )

            repository = await github_repository.create(
                session,
                RepositoryCreate(
                    platform=Platforms.github,
                    external_id=github_repo.id,
                    organization_id=organization.id,
                    name=github_repo.name,
                    is_private=github_repo.private,
                ),
            )

        issue = await github_issue.get_by_number(
            session,
            platform=Platforms.github,
            organization_id=organization.id,
            repository_id=repository.id,
            number=issue_number,
        )

        if not issue:
            log.info(
                "issue not found, creating it",
                organization_id=organization.id,
                repository_id=repository.id,
                number=issue_number,
            )

            try:
                issue_response = await client.rest.issues.async_get(
                    organization.name, repository.name, issue_number
                )
            except RequestFailed as e:
                if e.response.status_code == 404:
                    raise ResourceNotFound()
                # re-raise other status codes
                raise e

            github_issue_data = issue_response.parsed_data

            # This issue is a pull request, reject syncing it
            if github_issue_data.pull_request:
                log.info(
                    "issue is pull request, skipping",
                    organization_id=organization.id,
                    repository_id=repository.id,
                    number=issue_number,
                )
                raise ResourceNotFound()

            issue_schema = IssueCreate.from_github(
                github_issue_data,
                organization_id=organization.id,
                repository_id=repository.id,
            )
            issue = await github_issue.create(session, issue_schema)

        # load repository for return
        repository = await github_repository.get(
            session, id=repository.id, load_organization=True
        )
        if not repository:
            raise ResourceNotFound()

        return (organization, repository, issue)

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
            data: github.rest.Issue | github.rest.PullRequestSimple,
        ) -> bool:
            if isinstance(data, github.rest.PullRequestSimple):
                return True
            if data.pull_request:
                return True
            return False

        installation_id = (
            crawl_with_installation_id
            if crawl_with_installation_id
            else organization.installation_id
        )

        if not installation_id:
            raise Exception("no github installation id found")

        client = github.get_app_installation_client(installation_id)

        paginator = client.paginate(
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

    async def list_subscribed_issues(
        self,
        session: AsyncSession,
        user: User,
    ) -> list[Issue]:
        client = await github.get_user_client(session, user)

        issues = await client.rest.issues.async_list(
            filter_="subscribed",
            sort="updated",
            state="open",
            direction="desc",
            since=datetime.datetime.now() - datetime.timedelta(days=356),
            per_page=100,
        )

        res: list[Issue] = []

        for i in issues.parsed_data:
            if not i.repository:
                continue
            # skip issues in self owned repositories
            if i.repository.owner.login == user.username:
                continue
            if i.pull_request:
                continue
            if i.repository.private:
                continue

            org = await github_organization.update_or_create_org_from_github(
                session, i.repository.owner
            )

            repo = await github_repository.get_or_create_from_github(
                session,
                org,
                i.repository,
            )

            issue = await self.store(session, data=i, organization=org, repository=repo)
            res.append(issue)

        return res


github_issue = GithubIssueService(Issue)
