import json

import structlog

from polar.config import settings
from polar.logging import Logger
from polar.models.email_log import EmailLogStatus
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .react import render_from_json
from .repository import EmailLogRepository
from .sender import Attachment, email_sender

log: Logger = structlog.get_logger()


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
    template: str | None = None,
    props_json: str | None = None,
    attachments: list[Attachment] | None = None,
) -> None:
    if html_content is None:
        assert template is not None
        assert props_json is not None
        html_content = render_from_json(template, props_json)

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
        )
    except Exception as e:
        status = EmailLogStatus.failed
        error = str(e)
        raise
    finally:
        try:
            email_props = json.loads(props_json) if props_json else {}

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
                    email_props=email_props,
                    error=error,
                )
        except Exception:
            log.exception("Failed to write email log")
