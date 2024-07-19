import structlog

from polar.external_organization.service import (
    external_organization as external_organization_service,
)
from polar.issue.hooks import IssueHook, issue_upserted
from polar.repository.service import repository as repository_service
from polar.worker import QueueName, enqueue_job

from .badge import GithubBadge

log = structlog.get_logger()


async def schedule_embed_badge_task(
    hook: IssueHook,
) -> None:
    session = hook.session

    external_organization = await external_organization_service.get_linked(
        session, hook.issue.organization_id
    )
    if not external_organization:
        return

    repository = await repository_service.get(session, hook.issue.repository_id)
    if not repository:
        return

    should_embed, _ = GithubBadge.should_add_badge(
        external_organization, repository, hook.issue, triggered_from_label=False
    )
    if not should_embed:
        return

    log.info("github.badge.embed_on_issue:scheduled", issue_id=hook.issue.id)
    enqueue_job("github.badge.embed_on_issue", hook.issue.id)


async def schedule_fetch_references_and_dependencies(
    hook: IssueHook,
) -> None:
    enqueue_job(
        "github.issue.sync.issue_references",
        hook.issue.id,
        queue_name=QueueName.github_crawl,
    )
    enqueue_job(
        "github.issue.sync.issue_dependencies",
        hook.issue.id,
        queue_name=QueueName.github_crawl,
    )


issue_upserted.add(schedule_fetch_references_and_dependencies)
issue_upserted.add(schedule_embed_badge_task)
