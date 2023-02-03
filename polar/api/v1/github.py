from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Request
from githubkit import webhooks as gh
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


async def not_implemented(
    scope: str, action: str, payload: dict[str, Any]
) -> WebhookResponse:
    return WebhookResponse(success=False, message="Not implemented")


async def queue(request: Request) -> WebhookResponse:
    json_body = await request.json()
    event_scope = request.headers["X-GitHub-Event"]
    event: github.WebhookEvent = gh.parse_obj(event_scope, json_body)
    event_name = f"{event_scope}.{event.action}"

    mapping = {
        "issues.opened": hooks.issues_opened,
    }
    hook = mapping.get(event_name, not_implemented)
    queued = hook.delay(event_scope, event.action, json_body)
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
