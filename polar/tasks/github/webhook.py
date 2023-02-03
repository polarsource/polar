import asyncio
from typing import Any

import structlog

from polar.clients import github
from polar.postgres import AsyncSession
from polar.worker import asyncify_task, task

log = structlog.get_logger()


def get_event(scope: str, action: str, payload: dict[str, Any]) -> github.WebhookEvent:
    log.info("Celery task got event", scope=scope, action=action)
    return github.webhooks.parse_obj(scope, payload)


@task(name="github.webhook.issues.opened")
@asyncify_task(with_session=True)
async def issues_opened(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)
    return {"success": True, "message": "Called celery task"}
