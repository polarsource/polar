from typing import Any
import structlog
from polar.context import PolarContext
from polar.issue.hooks import IssueHook, issue_upserted
from polar.pull_request.hooks import PullRequestHook, pull_request_upserted

from polar.repository.signals import (
    repository_issue_synced,
    repository_issues_sync_completed,
)

from polar.eventstream.service import publish
from polar.models import Issue, Organization, Repository
from polar.postgres import AsyncSession

log = structlog.get_logger()


@repository_issue_synced.connect
async def on_issue_synced(
    sender: PolarContext,
    *,
    record: Issue,
    repository: Repository,
    organization: Organization,
    synced: int,
    session: AsyncSession,
) -> None:
    log.info("issue.synced", issue=record.id, title=record.title, synced=synced)
    await publish(
        "issue.synced",
        {
            "issue": {
                "id": record.id,
                "title": record.title,
            },
            "open_issues": repository.open_issues or 0,
            "synced_issues": synced,
            "repository_id": repository.id,
        },
        organization_id=organization.id,
    )


@repository_issues_sync_completed.connect
async def on_issue_sync_completed(
    sender: PolarContext,
    *,
    repository: Repository,
    organization: Organization,
    synced: int,
    session: AsyncSession,
) -> None:
    log.info("issue.sync.completed", repository=repository.id, synced=synced)
    await publish(
        "issue.sync.completed",
        {
            "open_issues": repository.open_issues or 0,
            "synced_issues": synced,
            "repository_id": repository.id,
        },
        organization_id=organization.id,
    )


###############################################################################
# Just a dummy implementation for now.
###############################################################################


async def on_issue_updated(hook: IssueHook) -> None:
    await publish(
        "issue.updated",
        {
            "issue_id": hook.issue.id,
            "organization_id": hook.issue.organization_id,
            "repository_id": hook.issue.repository_id,
        },
        repository_id=hook.issue.repository_id,
        organization_id=hook.issue.organization_id,
    )


issue_upserted.add(on_issue_updated)


async def on_pull_request_updated(hook: PullRequestHook) -> None:
    await publish(
        "pull_request.updated",
        {"pull_request": hook.pull_request.id},
        repository_id=hook.pull_request.repository_id,
        organization_id=hook.pull_request.organization_id,
    )


pull_request_upserted.add(on_pull_request_updated)
