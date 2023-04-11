import structlog

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


@repository_issue_synced.connect  # type: ignore
async def on_issue_synced(
    session: AsyncSession,
    *,
    repository: Repository,
    organization: Organization,
    record: Issue,
    created: bool,
    synced: int,
) -> None:
    log.info("issue.synced", issue=record.id, title=record.title)
    await publish(
        "issue.synced",
        {
            "issue": {
                "id": record.id,
                "title": record.title,
            },
            "expected": repository.open_issues,
            "synced": synced,
            "repository_id": repository.id,
        },
        organization_id=organization.id,
    )


@repository_issues_sync_completed.connect  # type: ignore
async def on_issue_sync_completed(
    session: AsyncSession,
    *,
    repository: Repository,
    organization: Organization,
    synced: int,
) -> None:
    log.info("issue.sync.completed", repository=repository.id, synced=synced)
    await publish(
        "issue.sync.completed",
        {
            "expected": repository.open_issues,
            "synced": synced,
            "repository_id": repository.id,
        },
        organization_id=organization.id,
    )


###############################################################################
# Just a dummy implementation for now.
###############################################################################


@issue_created.connect  # type: ignore
async def on_issue_created(issue: Issue, session: AsyncSession) -> None:
    await publish(
        "issue.created",
        {"issue": issue.id},
        repository_id=issue.repository_id,
        organization_id=issue.organization_id,
    )


@issue_updated.connect  # type: ignore
async def on_issue_updated(issue: Issue, session: AsyncSession) -> None:
    await publish(
        "issue.updated",
        {
            "issue_id": issue.id,
            "organization_id": issue.organization_id,
            "repository_id": issue.repository_id,
        },
        repository_id=issue.repository_id,
        organization_id=issue.organization_id,
    )


@pull_request_created.connect  # type: ignore
async def on_pull_request_created(pr: PullRequest, session: AsyncSession) -> None:
    await publish(
        "pull_request.created",
        {"pull_request": pr.id},
        repository_id=pr.repository_id,
        organization_id=pr.organization_id,
    )


@pull_request_updated.connect  # type: ignore
async def on_pull_request_updated(pr: PullRequest, session: AsyncSession) -> None:
    await publish(
        "pull_request.updated",
        {"pull_request": pr.id},
        repository_id=pr.repository_id,
        organization_id=pr.organization_id,
    )
