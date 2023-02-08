from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from polar.clients import github
from polar.config import settings
from polar.tasks.github import webhook as hooks

log = structlog.get_logger()

router = APIRouter(prefix="/integrations/github", tags=["integrations"])


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
        "issues.closed": hooks.issue_closed,
        "issues.labeled": hooks.issue_labeled,
        "pull_request.opened": hooks.pull_request_opened,
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
