import structlog

from polar import signals
from polar.event import publish
from polar.models import Issue, PullRequest

log = structlog.get_logger()

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
