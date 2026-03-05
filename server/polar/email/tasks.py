from typing import Any
from uuid import UUID

import structlog

from polar.config import EmailSender as EmailSenderType
from polar.config import settings
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.sent_email import SentEmail
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .sender import Attachment, EmailMetadata, email_sender

log: Logger = structlog.get_logger()


@actor(actor_name="email.send", priority=TaskPriority.HIGH)
async def email_send(
    to_email_addr: str,
    subject: str,
    html_content: str,
    from_name: str,
    from_email_addr: str,
    email_headers: dict[str, str] | None,
    reply_to_name: str | None,
    reply_to_email_addr: str | None,
    attachments: list[Attachment] | None = None,
    metadata: EmailMetadata | None = None,
) -> None:
    # If idempotency_key is set, check for existing sent email (dedup)
    idempotency_key = metadata.get("idempotency_key") if metadata else None
    if idempotency_key:
        async with AsyncSessionMaker() as session:
            from sqlalchemy import select

            result = await session.execute(
                select(SentEmail).where(
                    SentEmail.idempotency_key == idempotency_key
                )
            )
            if result.scalar_one_or_none() is not None:
                log.info(
                    "email.send.skipped_duplicate",
                    idempotency_key=idempotency_key,
                    to_email_addr=to_email_addr,
                )
                return

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

    # Determine the processor name
    processor: str | None = None
    if settings.EMAIL_SENDER == EmailSenderType.resend:
        processor = "resend"

    # Build and persist the sent email record
    _metadata: dict[str, Any] = metadata or {}
    sent_email = SentEmail(
        type=_metadata.get("email_type"),
        processor=processor,
        processor_id=processor_id,
        organization_id=_to_uuid(_metadata.get("organization_id")),
        customer_id=_to_uuid(_metadata.get("customer_id")),
        user_id=_to_uuid(_metadata.get("user_id")),
        to_email_addr=to_email_addr,
        subject=subject,
        props=_metadata.get("props"),
        idempotency_key=idempotency_key,
        sent_at=utc_now(),
    )

    async with AsyncSessionMaker() as session:
        session.add(sent_email)


def _to_uuid(value: str | None) -> UUID | None:
    if value is None:
        return None
    return UUID(value)
