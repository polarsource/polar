from typing import Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from httpx_oauth.clients.github import GitHubOAuth2
from pydantic import BaseModel

from polar.auth.session import auth_backend
from polar.auth.dependencies import current_active_user, fastapi_users
from polar.config import settings
from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.models import Organization, User
from polar.organization.schemas import OrganizationRead
from polar.postgres import AsyncSession, get_db_session
from polar.worker import enqueue_job

from .service.organization import github_organization
from .service.repository import github_repository
from .service.issue import github_issue
from .schemas import GithubBadgeRead

log = structlog.get_logger()

router = APIRouter(prefix="/integrations/github", tags=["integrations"])

github_oauth_client = GitHubOAuth2(
    settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET
)


###############################################################################
# ACCOUNT
###############################################################################

router.include_router(
    fastapi_users.get_oauth_router(
        github_oauth_client,
        auth_backend,
        settings.SECRET,
        redirect_url=settings.GITHUB_REDIRECT_URL,
        associate_by_email=True,
    ),
)

###############################################################################
# BADGE
###############################################################################


@router.get(
    "/{org}/{repo}/issues/{number}/badges/{badge_type}", response_model=GithubBadgeRead
)
async def get_badge_settings(
    org: str,
    repo: str,
    number: int,
    badge_type: Literal["funding"],
    session: AsyncSession = Depends(get_db_session),
) -> GithubBadgeRead:
    organization = await github_organization.get_by_name(session, Platforms.github, org)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    repository = await github_repository.get_by(session, name=repo)
    if repository is None:
        raise HTTPException(status_code=404, detail="Repository not found")

    issue = await github_issue.get_by(
        session,
        organization_id=organization.id,
        repository_id=repository.id,
        number=number,
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if not issue.funding_badge_embedded_at:
        raise HTTPException(status_code=404, detail="Funding badge not found")

    badge = GithubBadgeRead(badge_type=badge_type, amount=None)
    return badge


###############################################################################
# INSTALLATIONS
###############################################################################


class InstallationCreate(BaseModel):
    platform: Literal["github"]
    external_id: int


@router.post("/installations", response_model=OrganizationRead)
async def install(
    installation: InstallationCreate,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(current_active_user),
) -> Organization | None:
    organization = await github_organization.install(
        session, user, installation_id=installation.external_id
    )

    return organization


###############################################################################
# WEBHOOK
###############################################################################


class WebhookResponse(BaseModel):
    success: bool
    message: str | None = None
    job_id: str | None = None


IMPLEMENTED_WEBHOOKS = {
    "installation.created",
    "installation.deleted",
    "installation.suspend",
    "installation.unsuspend",
    "installation_repositories.added",
    "installation_repositories.removed",
    "issues.opened",
    "issues.edited",
    "issues.closed",
    "issues.labeled",
    "pull_request.opened",
    "pull_request.edited",
    "pull_request.closed",
    "pull_request.reopened",
    "pull_request.synchronize",
}


def not_implemented(
    scope: str, action: str, payload: dict[str, Any]
) -> WebhookResponse:
    return WebhookResponse(success=False, message="Not implemented")


async def enqueue(request: Request) -> WebhookResponse:
    json_body = await request.json()
    event_scope = request.headers["X-GitHub-Event"]
    event_action = json_body["action"]
    event_name = f"{event_scope}.{event_action}"

    if event_name not in IMPLEMENTED_WEBHOOKS:
        return not_implemented(event_scope, event_action, json_body)

    task_name = f"github.webhook.{event_name}"
    enqueued = await enqueue_job(task_name, event_scope, event_action, json_body)
    if not enqueued:
        return WebhookResponse(success=False, message="Failed to enqueue task")

    log.info("github.webhook.queued", task_name=task_name)
    return WebhookResponse(success=True, job_id=enqueued.job_id)


@router.post("/webhook", response_model=WebhookResponse)
async def webhook(request: Request) -> WebhookResponse:
    valid_signature = github.webhooks.verify(
        settings.GITHUB_APP_WEBHOOK_SECRET,
        await request.body(),
        request.headers["X-Hub-Signature-256"],
    )
    if valid_signature:
        return await enqueue(request)

    # Should be 403 Forbidden, but...
    # Throwing unsophisticated hackers/scrapers/bots off the scent
    raise HTTPException(status_code=404)
