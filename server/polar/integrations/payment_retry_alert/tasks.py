import uuid
from typing import Annotated

import structlog

from polar.config import settings
from polar.external_event.service import external_event as external_event_service
from polar.logging import Logger
from polar.models.external_event import ExternalEventSource
from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .client import PaymentRetryAlertAPIError
from .client import client as payment_retry_alert_client
from .service import payment_retry_alert as payment_retry_alert_service
from .types import RetryOutcome

log: Logger = structlog.get_logger()


@actor(
    actor_name="payment_retry_alert.webhook.alert.created",
    priority=TaskPriority.MEDIUM,
)
async def alert_created(event_id: Annotated[uuid.UUID, LoggableField]) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.payment_retry_alert, event_id
        ) as event:
            await payment_retry_alert_service.handle_alert(
                session, event.data["data"]["object"]
            )


@actor(
    actor_name="payment_retry_alert.report_outcome",
    priority=TaskPriority.LOW,
)
async def report_outcome(
    alert_id: Annotated[str, LoggableField],
    outcome: Annotated[str, LoggableField],
) -> None:
    if not settings.PAYMENT_RETRY_ALERT_API_KEY:
        log.info(
            "PaymentRetryAlert API key not configured, skipping outcome report",
            alert_id=alert_id,
        )
        return
    try:
        await payment_retry_alert_client.update_retry_outcome(
            alert_id, RetryOutcome(outcome)
        )
    except PaymentRetryAlertAPIError as e:
        if e.is_retryable:
            raise
        log.warning(
            "PaymentRetryAlert rejected outcome report",
            alert_id=alert_id,
            status_code=e.response_status_code,
        )
