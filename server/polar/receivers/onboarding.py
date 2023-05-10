from typing import Any
import structlog
from polar.context import PolarContext

from polar.issue.signals import (
    issue_created,
    issue_updated,
)
from polar.repository.signals import (
    repository_issue_synced,
    repository_issues_sync_completed,
)
from polar.pull_request.signals import pull_request_created, pull_request_updated
from polar.eventstream.service import publish
from polar.models import Issue, Organization, PullRequest, Repository
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


@issue_created.connect
async def on_issue_created(sender: PolarContext, *, item: Issue, **values: Any) -> None:
    await publish(
        "issue.created",
        {"issue": item.id},
        repository_id=item.repository_id,
        organization_id=item.organization_id,
    )


@issue_updated.connect
async def on_issue_updated(sender: PolarContext, *, item: Issue, **values: Any) -> None:
    await publish(
        "issue.updated",
        {
            "issue_id": item.id,
            "organization_id": item.organization_id,
            "repository_id": item.repository_id,
        },
        repository_id=item.repository_id,
        organization_id=item.organization_id,
    )


@pull_request_created.connect
async def on_pull_request_created(
    sender: PolarContext, *, item: PullRequest, **values: Any
) -> None:
    await publish(
        "pull_request.created",
        {"pull_request": item.id},
        repository_id=item.repository_id,
        organization_id=item.organization_id,
    )


@pull_request_updated.connect
async def on_pull_request_updated(
    sender: PolarContext, *, item: PullRequest, **values: Any
) -> None:
    await publish(
        "pull_request.updated",
        {"pull_request": item.id},
        repository_id=item.repository_id,
        organization_id=item.organization_id,
    )
