import structlog

from polar.issue.hooks import IssueHook, issue_upserted
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service
from polar.worker import enqueue_job

from .badge import GithubBadge

log = structlog.get_logger()


async def schedule_embed_badge_task(
    hook: IssueHook,
) -> None:
    session = hook.session

    organization = await organization_service.get(session, hook.issue.organization_id)
    if not organization:
        return

    repository = await repository_service.get(session, hook.issue.repository_id)
    if not repository:
        return

    should_embed, _ = GithubBadge.should_add_badge(
        organization, repository, hook.issue, triggered_from_label=False
    )
    if not should_embed:
        return

    log.info("github.badge.embed_on_issue:scheduled", issue_id=hook.issue.id)
    await enqueue_job("github.badge.embed_on_issue", hook.issue.id)


async def schedule_fetch_references_and_dependencies(
    hook: IssueHook,
) -> None:
    await enqueue_job("github.issue.sync.issue_references", hook.issue.id)
    await enqueue_job("github.issue.sync.issue_dependencies", hook.issue.id)


issue_upserted.add(schedule_fetch_references_and_dependencies)
issue_upserted.add(schedule_embed_badge_task)
