from datetime import datetime
from typing import List, Literal, Callable, Any, Coroutine
from uuid import UUID

import structlog
from sqlalchemy.exc import IntegrityError
from blinker import Signal
from githubkit import Paginator
from polar.kit.extensions.sqlalchemy import sql

from polar.models import Organization, Repository, Issue, PullRequest
from polar.enums import Platforms
from polar.models.user import User
from polar.models.user_repository import UserRepository
from polar.postgres import AsyncSession
from polar.worker import enqueue_job
from polar.repository.schemas import RepositoryCreate
from polar.repository.service import RepositoryService
from polar.repository.signals import (
    repository_issue_synced,
    repository_issues_sync_completed,
)

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
        on_sync_signal: Signal | None = None,
        on_completed_signal: Signal | None = None,
    ) -> tuple[SyncedCount, ErrorCount]:
        count, synced, errors = 0, 0, 0
        async for data in paginator:
            if skip_condition and skip_condition(data):
                continue

            count += 1
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

            synced += 1
            log.debug(
                f"{resource_type}.synced",
                organization_id=organization.id,
                repository_id=repository.id,
                id=record.id,
                title=record.title,
            )

            if not on_sync_signal:
                continue

            await on_sync_signal.send_async(
                session,
                repository=repository,
                organization=organization,
                record=record,
                created=record.was_created,
                synced=synced,
            )

        log.info(
            f"{resource_type}.sync.completed",
            organization_id=organization.id,
            repository_id=repository.id,
            synced=synced,
            errors=errors,
        )
        if on_completed_signal:
            await on_completed_signal.send_async(
                session,
                repository=repository,
                organization=organization,
                synced=synced,
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
    ) -> tuple[SyncedCount, ErrorCount]:
        # We get PRs in the issues list too, but super slim versions of them.
        # Since we sync PRs separately, we therefore skip them here.
        def skip_if_pr(
            data: github.rest.Issue | github.rest.PullRequestMinimal,
        ) -> bool:
            return bool(getattr(data, "pull_request", None))

        client = github.get_app_installation_client(organization.installation_id)
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
    ) -> tuple[SyncedCount, ErrorCount]:
        client = github.get_app_installation_client(organization.installation_id)
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
            on_sync_signal=repository_issue_synced,
            resource_type="pull_request",
        )
        return (synced, errors)

    async def enqueue_sync(
        self,
        repository: Repository,
    ) -> None:
        await enqueue_job(
            "github.repo.sync.issues", repository.organization_id, repository.id
        )
        await enqueue_job(
            "github.repo.sync.pull_requests", repository.organization_id, repository.id
        )

    async def install_for_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        installation_id: int,
        trigger_sync_job: bool = False,
    ) -> list[Repository] | None:
        client = github.get_app_installation_client(installation_id)
        response = await client.rest.apps.async_list_repos_accessible_to_installation()
        github.ensure_expected_response(response)

        repos = [
            RepositoryCreate.from_github(organization, repo)
            for repo in response.parsed_data.repositories
        ]

        instances = await self.upsert_many(session, repos)

        if trigger_sync_job:
            for instance in instances:
                await self.enqueue_sync(instance)

        return instances

    async def ensure_installed(
        self,
        session: AsyncSession,
        organization: Organization,
        repo: github.rest.Repository,
    ) -> Repository | None:
        to_create = RepositoryCreate.from_github(organization, repo)
        return await self.upsert(session, to_create)

    async def add_user(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        user: User,
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = UserRepository(
                user_id=user.id,
                organization_id=organization.id,
                repository_id=repository.id,
                validated_at=datetime.now(),
            )
            session.add(relation)
            await nested.commit()
            log.info(
                "repository.add_user",
                user_id=user.id,
                organization_id=organization.id,
                repository_id=repository.id,
            )
        except IntegrityError as e:
            # TODO: Currently, we treat this as success since the connection
            # exists. However, once we use status to distinguish active/inactive
            # installations we need to change this.
            log.info(
                "repository.add_user.already_exists",
                user_id=user.id,
                organization_id=organization.id,
                repository_id=repository.id,
            )

            log.error("already exists", e=e)

            await nested.rollback()

        # Update validated_at
        stmt = (
            sql.Update(UserRepository)
            .where(
                UserRepository.user_id == user.id,
                UserRepository.organization_id == organization.id,
                UserRepository.repository_id == repository.id,
            )
            .values(
                validated_at=datetime.now(),
            )
        )
        await session.execute(stmt)
        await session.commit()

    async def cleanup_repositories_access(
        self,
        session: AsyncSession,
        organization_id: UUID,
        repository_ids: List[UUID],
        user: User,
    ) -> None:
        """
        Remove entries for repositories that the user doesn't have access to anymore
        """
        stmt = sql.Delete(UserRepository).where(
            UserRepository.user_id == user.id,
            UserRepository.organization_id == organization_id,
            UserRepository.repository_id.not_in(repository_ids),
        )
        await session.execute(stmt)
        await session.commit()


github_repository = GithubRepositoryService(Repository)
