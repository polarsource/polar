import structlog

from polar import signals
from polar.event import publish
from polar.models import Issue, Organization, PullRequest, Repository

log = structlog.get_logger()


@signals.issue_synced.connect
async def on_issue_synced(
    sender: Repository,
    organization: Organization,
    issue: Issue,
    synced: int
) -> None:
    log.info("issue.synced", issue=issue.id, title=issue.title)
    await publish(
        "issue.synced",
        {
            "issue": {
                "id": issue.id,
                "title": issue.title,
            },
            "expected": sender.open_issues,
            "synced": synced,
            "repository_id": sender.id,
        },
        organization_id=organization.id,
    )


@signals.issue_sync_completed.connect
async def on_issue_sync_completed(
    sender: Repository,
    organization: Organization,
    synced: int
) -> None:
    log.info("issue.sync.completed", repository=sender.id, synced=synced)
    await publish(
        "issue.sync.completed",
        {
            "expected": sender.open_issues,
            "synced": synced,
            "repository_id": sender.id,
        },
        organization_id=organization.id,
    )


###############################################################################
# Just a dummy implementation for now.
###############################################################################


@signals.issue_created.connect
async def on_issue_created(issue: Issue) -> None:
    await publish(
        "issue.created",
        {"issue": issue.id},
        repository_id=issue.repository_id,
        organization_id=issue.organization_id,
    )


@signals.issue_updated.connect
async def on_issue_updated(issue: Issue) -> None:
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


@signals.pull_request_created.connect
async def on_pull_request_created(pr: PullRequest) -> None:
    await publish(
        "pull_request.created",
        {"pull_request": pr.id},
        repository_id=pr.repository_id,
        organization_id=pr.organization_id,
    )


@signals.pull_request_updated.connect
async def on_pull_request_updated(pr: PullRequest) -> None:
    await publish(
        "pull_request.updated",
        {"pull_request": pr.id},
        repository_id=pr.repository_id,
        organization_id=pr.organization_id,
    )
