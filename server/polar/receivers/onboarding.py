import structlog
from polar.event import publish
from polar.models import Issue

from polar import signals

log = structlog.get_logger()


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
        {"issue": issue.id},
        repository_id=issue.repository_id,
        organization_id=issue.organization_id,
    )
