from uuid import UUID
import structlog
from polar.integrations.github import service

from polar.worker import JobContext, task
from polar.postgres import AsyncSessionLocal

from .utils import get_organization_and_repo
from ..service.issue import github_issue

log = structlog.get_logger()


@task("github.issue.embed_badge")
async def embed_badge(ctx: JobContext, issue_id: UUID) -> None:
    async with AsyncSessionLocal() as session:
        issue = await github_issue.get(session, issue_id)
        if not issue or not issue.organization_id or not issue.repository_id:
            log.warning(
                "github.issue.embed_badge", error="issue not found", issue_id=issue_id
            )
            return

        organization, repository = await get_organization_and_repo(
            session, issue.organization_id, issue.repository_id
        )
        await github_issue.embed_badge(
            session, organization=organization, repository=repository, issue=issue
        )


@task("github.issue.sync.issue_references")
async def issue_sync_issue_references(
    ctx: JobContext,
    issue_id: UUID,
) -> None:
    async with AsyncSessionLocal() as session:
        issue = await github_issue.get(session, issue_id)
        if not issue or not issue.organization_id or not issue.repository_id:
            log.warning(
                "github.issue.embed_badge", error="issue not found", issue_id=issue_id
            )
            return

        organization, repository = await get_organization_and_repo(
            session, issue.organization_id, issue.repository_id
        )

        await service.github_reference.sync_issue_references(
            session,
            org=organization,
            repo=repository,
            issue=issue,
        )
