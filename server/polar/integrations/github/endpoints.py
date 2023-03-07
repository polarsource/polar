from typing import Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from httpx_oauth.clients.github import GitHubOAuth2
from pydantic import BaseModel

from polar.auth.session import auth_backend
from polar.auth.dependencies import current_active_user, fastapi_users
from polar.config import settings
from polar.integrations.github import client as github
from polar.models import Organization, User
from polar.organization.schemas import OrganizationRead
from polar.postgres import AsyncSession, get_db_session

from .service.organization import github_organization
from .tasks import webhook as hooks

log = structlog.get_logger()

router = APIRouter()

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
    task_id: str | None = None


def not_implemented(
    scope: str, action: str, payload: dict[str, Any]
) -> WebhookResponse:
    return WebhookResponse(success=False, message="Not implemented")


async def queue(request: Request) -> WebhookResponse:
    json_body = await request.json()
    event_scope = request.headers["X-GitHub-Event"]
    event_action = json_body["action"]
    event_name = f"{event_scope}.{event_action}"

    task_mapping = {
        "installation.created": hooks.installation_created,
        "installation.deleted": hooks.installation_delete,
        "installation.suspend": hooks.installation_suspend,
        "installation.unsuspend": hooks.installation_unsuspend,
        "installation_repositories.added": hooks.repositories_added,
        "installation_repositories.removed": hooks.repositories_removed,
        "issues.opened": hooks.issue_opened,
        "issues.edited": hooks.issue_edited,
        "issues.closed": hooks.issue_closed,
        "issues.labeled": hooks.issue_labeled,
        "pull_request.opened": hooks.pull_request_opened,
        "pull_request.edited": hooks.pull_request_edited,
        "pull_request.closed": hooks.pull_request_closed,
        "pull_request.reopened": hooks.pull_request_reopened,
        "pull_request.synchronize": hooks.pull_request_synchronize,
    }
    task = task_mapping.get(event_name)
    if not task:
        return not_implemented(event_scope, event_action, json_body)

    queued = task.delay(event_scope, event_action, json_body)
    if settings.CELERY_TASK_ALWAYS_EAGER:
        await queued.result

    log.info("github.webhook.queued", event_name=event_name)
    return WebhookResponse(success=True, task_id=queued.id)


@router.post("/webhook", response_model=WebhookResponse)
async def webhook(request: Request) -> WebhookResponse:
    valid_signature = github.webhooks.verify(
        settings.GITHUB_APP_WEBHOOK_SECRET,
        await request.body(),
        request.headers["X-Hub-Signature-256"],
    )
    if valid_signature:
        return await queue(request)

    # Should be 403 Forbidden, but...
    # Throwing unsophisticated hackers/scrapers/bots off the scent
    raise HTTPException(status_code=404)
