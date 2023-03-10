from uuid import UUID
import structlog

from polar.worker import get_db_session, sync_worker, task

from .utils import get_organization_and_repo
from ..service.issue import github_issue

log = structlog.get_logger()


@task(name="github.issue.embed_badge")
@sync_worker()
async def embed_badge(issue_id: UUID) -> None:
    async with get_db_session() as session:
        issue = await github_issue.get(session, issue_id)
        if not issue:
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
