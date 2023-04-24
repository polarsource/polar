from typing import Any
import structlog
from polar.context import PolarContext

from polar.models import Issue, Organization, Repository
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .signals import github_issue_created, github_issue_updated
from .badge import GithubBadge

log = structlog.get_logger()

# TODO: Move eventstream updates here since we can pass more data than issue.signals


@github_issue_created.connect
async def schedule_embed_badge_task(
    ctx: PolarContext,
    *,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    session: AsyncSession,
) -> None:
    should_embed, _ = GithubBadge.should_embed(
        organization, repository, issue, setting_retroactive_override=False
    )
    if not should_embed:
        return

    log.info("github.badge.embed_on_issue:scheduled", issue_id=issue.id)
    await enqueue_job("github.badge.embed_on_issue", issue.id)


@github_issue_created.connect
async def schedule_fetch_references_and_dependencies(
    ctx: PolarContext,
    *,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    session: AsyncSession,
) -> None:
    await enqueue_job("github.issue.sync.issue_references", issue.id)
    await enqueue_job("github.issue.sync.issue_dependencies", issue.id)


@github_issue_updated.connect
async def schedule_updated_fetch_references_and_dependencies(
    ctx: PolarContext,
    *,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    session: AsyncSession,
) -> None:
    await enqueue_job("github.issue.sync.issue_references", issue.id)
    await enqueue_job("github.issue.sync.issue_dependencies", issue.id)
