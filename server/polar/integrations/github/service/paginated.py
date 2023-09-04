from __future__ import annotations

from typing import Any, Callable, Coroutine, List, Literal, Union

import structlog
from githubkit import Paginator

from polar.integrations.github import client as github
from polar.kit.hook import Hook
from polar.models import Issue, Organization, Repository
from polar.models.pull_request import PullRequest
from polar.postgres import AsyncSession
from polar.repository.hooks import SyncCompletedHook, SyncedHook

log = structlog.get_logger()


SyncedCount = int
ErrorCount = int


class GitHubPaginatedService:
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
        skip_condition: Callable[
            [Union[github.rest.Issue, github.rest.PullRequestSimple]], bool
        ]
        | None = None,
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


github_paginated_service = GitHubPaginatedService()
