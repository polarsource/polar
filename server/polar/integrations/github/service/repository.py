from typing import Any, Callable, Coroutine, Literal, Sequence

import structlog
from githubkit import Paginator, Response
from githubkit.rest import (
    InstallationRepositoriesGetResponse200,
)
from githubkit.rest import (
    Repository as GitHubKitRepository,
)

from polar.enums import Platforms
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.hook import Hook
from polar.models import Issue, Organization, PullRequest, Repository
from polar.postgres import AsyncSession
from polar.repository.hooks import (
    SyncCompletedHook,
    SyncedHook,
    repository_issue_synced,
    repository_issues_sync_completed,
)
from polar.repository.schemas import RepositoryCreate
from polar.repository.service import RepositoryService
from polar.worker import enqueue_job

from .. import client as github
from .issue import github_issue
from .pull_request import github_pull_request

log = structlog.get_logger()


SyncedCount = int
ErrorCount = int


class GithubRepositoryService(RepositoryService):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Repository | None:
        return await self.get_by(
            session, platform=Platforms.github, external_id=external_id
        )

    async def store_paginated_resource(
        self,
        session: AsyncSession,
        *,
        paginator: Paginator[github.rest.Issue]
        | Paginator[github.rest.PullRequestSimple],
        store_resource_method: Callable[
            ..., Coroutine[Any, Any, Issue | PullRequest | None]
        ],
        organization: Organization,
        repository: Repository,
        resource_type: Literal["issue", "pull_request"],
        skip_condition: Callable[..., bool] | None = None,
        on_sync_signal: Hook[SyncedHook] | None = None,
        on_completed_signal: Hook[SyncCompletedHook] | None = None,
    ) -> tuple[SyncedCount, ErrorCount]:
        synced, errors = 0, 0
        async for data in paginator:
            synced += 1

            if skip_condition and skip_condition(data):
                continue

            record = await store_resource_method(
                session,
                data=data,
                organization=organization,
                repository=repository,
            )

            if not record:
                log.warning(
                    f"{resource_type}.sync.failed",
                    error="save was unsuccessful",
                    received=data.dict(),
                )
                errors += 1
                continue

            log.debug(
                f"{resource_type}.synced",
                organization_id=organization.id,
                repository_id=repository.id,
                id=record.id,
                title=record.title,
            )

            if on_sync_signal:
                await on_sync_signal.call(
                    SyncedHook(
                        repository=repository,
                        organization=organization,
                        record=record,
                        synced=synced,
                    )
                )

        log.info(
            f"{resource_type}.sync.completed",
            organization_id=organization.id,
            repository_id=repository.id,
            synced=synced,
            errors=errors,
        )

        if on_completed_signal:
            await on_completed_signal.call(
                SyncCompletedHook(
                    repository=repository,
                    organization=organization,
                    synced=synced,
                )
            )

        return (synced, errors)

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
            data: github.rest.Issue | github.rest.PullRequestMinimal,
        ) -> bool:
            return bool(getattr(data, "pull_request", None))

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
        synced, errors = await self.store_paginated_resource(
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

    async def sync_pull_requests(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        state: Literal["open", "closed", "all"] = "open",
        sort: Literal["created", "updated", "popularity", "long-running"] = "updated",
        direction: Literal["asc", "desc"] = "desc",
        per_page: int = 30,
        crawl_with_installation_id: int
        | None = None,  # Override which installation to use when crawling
    ) -> tuple[SyncedCount, ErrorCount]:
        installation_id = (
            crawl_with_installation_id
            if crawl_with_installation_id
            else organization.installation_id
        )

        if not installation_id:
            raise Exception("no github installation id found")

        client = github.get_app_installation_client(installation_id)

        paginator = client.paginate(
            client.rest.pulls.async_list,
            owner=organization.name,
            repo=repository.name,
            state=state,
            sort=sort,
            direction=direction,
            per_page=per_page,
        )
        synced, errors = await self.store_paginated_resource(
            session,
            paginator=paginator,
            store_resource_method=github_pull_request.store_simple,
            organization=organization,
            repository=repository,
            resource_type="pull_request",
        )
        return (synced, errors)

    async def enqueue_sync(
        self,
        repository: Repository,
        crawl_with_installation_id: int
        | None = None,  # Override which installation to use when crawling
    ) -> None:
        await enqueue_job(
            "github.repo.sync.issues",
            repository.organization_id,
            repository.id,
            crawl_with_installation_id=crawl_with_installation_id,
        )
        await enqueue_job(
            "github.repo.sync.pull_requests",
            repository.organization_id,
            repository.id,
            crawl_with_installation_id=crawl_with_installation_id,
        )

    async def install_for_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        installation_id: int,
    ) -> Sequence[Repository] | None:
        client = github.get_app_installation_client(installation_id)

        instances = []

        def mapper(
            res: Response[InstallationRepositoriesGetResponse200],
        ) -> list[GitHubKitRepository]:
            return res.parsed_data.repositories

        async for repo in client.paginate(
            client.rest.apps.async_list_repos_accessible_to_installation,
            map_func=mapper,
        ):
            create = RepositoryCreate.from_github(organization, repo)
            inst = await self.create_or_update(session, create)

            # un-delete if previously deleted
            if inst.deleted_at is not None:
                inst.deleted_at = None
                await inst.save(session, autocommit=False)

            instances.append(inst)

        await session.commit()
        for installation in instances:
            await self.enqueue_sync(installation)
        return instances


github_repository = GithubRepositoryService(Repository)
