import structlog

from polar.eventstream.service import publish
from polar.issue.hooks import IssueHook, issue_upserted
from polar.repository.hooks import (
    SyncCompletedHook,
    SyncedHook,
    repository_issue_synced,
    repository_issues_sync_completed,
)

log = structlog.get_logger()


async def on_issue_synced(hook: SyncedHook) -> None:
    log.info(
        "issue.synced",
        issue=hook.record.id,
        title=hook.record.title,
        synced=hook.synced,
    )
    await publish(
        "issue.synced",
        {
            "issue": {
                "id": hook.record.id,
                "title": hook.record.title,
            },
            "open_issues": hook.repository.open_issues or 0,
            "synced_issues": hook.synced,
            "repository_id": hook.repository.id,
        },
        organization_id=hook.organization.id,
        run_in_worker=False,
        redis=hook.redis,
    )


repository_issue_synced.add(on_issue_synced)


async def on_issue_sync_completed(
    hook: SyncCompletedHook,
) -> None:
    log.info("issue.sync.completed", repository=hook.repository.id, synced=hook.synced)
    await publish(
        "issue.sync.completed",
        {
            "open_issues": hook.repository.open_issues or 0,
            "synced_issues": hook.synced,
            "repository_id": hook.repository.id,
        },
        organization_id=hook.organization.id,
        run_in_worker=False,
        redis=hook.redis,
    )


repository_issues_sync_completed.add(on_issue_sync_completed)


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
        organization_id=hook.issue.organization_id,
        run_in_worker=False,
        redis=hook.redis,
    )


issue_upserted.add(on_issue_updated)
