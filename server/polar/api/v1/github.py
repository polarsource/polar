from typing import Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from polar.actions import github_organization
from polar.api.auth import auth_backend, github_oauth_client
from polar.api.deps import current_active_user, fastapi_users, get_db_session
from polar.config import settings
from polar.models import Organization, User
from polar.postgres import AsyncSession
from polar.schema.organization import OrganizationSchema
from polar.tasks.github import webhook as hooks
from pydantic import BaseModel

from polar.clients import github

log = structlog.get_logger()

router = APIRouter(prefix="/integrations/github", tags=["integrations"])


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


@router.post("/installations", response_model=OrganizationSchema)
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
    if settings.is_testing() and settings.CELERY_TASK_ALWAYS_EAGER:
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

    # Should be 403 Forbidden, but throwing unsophisticated hackers/scrapers/bots off the scent
    raise HTTPException(status_code=404)
