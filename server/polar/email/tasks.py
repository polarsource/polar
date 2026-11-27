import json
from datetime import timedelta
from typing import Annotated, Any

import structlog

from polar.config import settings
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.email_log import EmailLogStatus
from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .react import render_from_json
from .repository import EmailLogRepository, extract_organization_id
from .schemas import EmailTemplate
from .sender import Attachment, email_sender

log: Logger = structlog.get_logger()


def _build_tags(template: str | None, email_props: dict[str, Any]) -> dict[str, str]:
    tags: dict[str, str] = {}
    if template is not None:
        tags["category"] = template
    organization_id = extract_organization_id(email_props)
    if organization_id is not None:
        tags["tenant_id"] = str(organization_id)
    return tags


SECRET_PROPS: dict[str, tuple[str, ...]] = {
    EmailTemplate.login_code: ("code",),
    EmailTemplate.customer_session_code: ("code",),
    EmailTemplate.organization_email_verification: ("code",),
    EmailTemplate.email_update: ("url",),
    EmailTemplate.customer_email_update_verification: ("url",),
    EmailTemplate.seat_invitation: ("claim_url",),
}


def _redact_secret_props(
    template: str | None, email_props: dict[str, Any]
) -> dict[str, Any]:
    secret_fields = SECRET_PROPS.get(template or "", ())
    return {
        key: "[Redacted]" if key in secret_fields else value
        for key, value in email_props.items()
    }


UNSUPPRESS_WINDOW = timedelta(days=30)
UNSUPPRESS_MAX_BOUNCES = 1


async def _remove_suppression_after_failure(to_email_addr: str) -> None:
    async with AsyncSessionMaker() as session:
        repository = EmailLogRepository.from_session(session)
        latest = await repository.get_latest_by_to_email_addr(to_email_addr)
        if latest is None or latest.status != EmailLogStatus.failed:
            return
        # Bounced again after a previous unsuppression: it really doesn't work
        bounces = await repository.count_bounces_since(
            to_email_addr, utc_now() - UNSUPPRESS_WINDOW
        )

    if bounces > UNSUPPRESS_MAX_BOUNCES:
        log.info("email.remove_suppression_skipped", bounces=bounces)
        return

    await email_sender.remove_suppression(to_email_addr)


@actor(actor_name="email.send", priority=TaskPriority.HIGH)
async def email_send(
    to_email_addr: str,
    subject: str,
    html_content: str | None,
    from_name: str,
    from_email_addr: str,
    email_headers: dict[str, str] | None,
    reply_to_name: str | None,
    reply_to_email_addr: str | None,
    template: Annotated[str | None, LoggableField] = None,
    props_json: str | None = None,
    attachments: list[Attachment] | None = None,
    deduplication_key: str | None = None,
    unsuppress: bool = False,
) -> None:
    if html_content is None:
        assert template is not None
        assert props_json is not None
        html_content = await render_from_json(template, props_json)

    email_props = json.loads(props_json) if props_json else {}
    tags = _build_tags(template, email_props)

    # Removing a suppression needs a full-access Resend key, which only production has
    if unsuppress and settings.is_production():
        try:
            await _remove_suppression_after_failure(to_email_addr)
        except Exception:
            log.warning("email.remove_suppression_failed", exc_info=True)

    processor_id: str | None = None
    status = EmailLogStatus.sent
    error: str | None = None

    try:
        processor_id = await email_sender.send(
            to_email_addr=to_email_addr,
            subject=subject,
            html_content=html_content,
            from_name=from_name,
            from_email_addr=from_email_addr,
            email_headers=email_headers,
            reply_to_name=reply_to_name,
            reply_to_email_addr=reply_to_email_addr,
            attachments=attachments,
            tags=tags,
        )
    except Exception as e:
        status = EmailLogStatus.failed
        error = str(e)
        raise
    finally:
        try:
            async with AsyncSessionMaker() as session:
                repository = EmailLogRepository.from_session(session)
                await repository.create_log(
                    status=status,
                    processor=settings.EMAIL_SENDER,
                    processor_id=processor_id,
                    to_email_addr=to_email_addr,
                    from_email_addr=from_email_addr,
                    from_name=from_name,
                    subject=subject,
                    email_template=template,
                    email_props=_redact_secret_props(template, email_props),
                    error=error,
                    deduplication_key=deduplication_key,
                )
        except Exception:
            log.exception("Failed to write email log")


@actor(
    actor_name="email_log.prune",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def email_log_prune() -> None:
    async with AsyncSessionMaker() as session:
        repository = EmailLogRepository.from_session(session)
        await repository.delete_before(utc_now() - settings.EMAIL_LOG_RETENTION_PERIOD)
