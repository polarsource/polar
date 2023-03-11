import structlog

from polar.models import Issue, Organization, Repository
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .signals import github_issue_created
from .badge import GithubBadge

log = structlog.get_logger()

# TODO: Move eventstream updates here since we can pass more data than issue.signals


@github_issue_created.connect
async def schedule_embed_badge_task(
    session: AsyncSession,  # TODO: Treated as "sender" in Blinker... What do we want?
    *,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> None:
    should_embed, _ = GithubBadge.should_embed(
        organization, repository, issue, setting_retroactive_override=False
    )
    if not should_embed:
        return

    log.info("github.issue.embed_badge:scheduled", issue_id=issue.id)
    await enqueue_job("github.issue.embed_badge", issue.id)
