import structlog

from polar import signals
from polar.event import publish
from polar.models import Issue, Organization, PullRequest, Repository

log = structlog.get_logger()


@signals.repository_issue_synced.connect
async def on_repository_issue_synced(
    sender: Repository, organization: Organization, issue: Issue
) -> None:
    log.info("repository.issue.synced", issue=issue.id, title=issue.title)
    await publish(
        "issue.synced",
        {
            "issue": {
                "id": issue.id,
                "title": issue.title,
            },
            "open_issues": sender.open_issues,
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
            "organization_name": issue.organization_name,
            "repository_id": issue.repository_id,
            "repository_name": issue.repository_name,
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
