from __future__ import annotations

from collections.abc import Callable, Coroutine
from typing import Any, Literal

import structlog
from githubkit import Paginator

from polar.kit.hook import Hook
from polar.models import Issue, Organization, Repository
from polar.models.pull_request import PullRequest
from polar.postgres import AsyncSession
from polar.repository.hooks import SyncCompletedHook, SyncedHook

from .. import types

log = structlog.get_logger()


SyncedCount = int
ErrorCount = int


class GitHubPaginatedService:
    async def store_paginated_resource(
        self,
        session: AsyncSession,
        *,
        paginator: Paginator[types.Issue] | Paginator[types.PullRequestSimple],
        store_resource_method: Callable[
            ..., Coroutine[Any, Any, Issue | PullRequest | None]
        ],
        organization: Organization,
        repository: Repository,
        resource_type: Literal["issue", "pull_request"],
        skip_condition: Callable[[types.Issue | types.PullRequestSimple], bool]
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
                    received=data.model_dump(mode="json"),
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
