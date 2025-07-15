from abc import ABC, abstractmethod
from typing import Any

import httpx
import structlog
from email_validator import validate_email

from polar.config import EmailSender as EmailSenderType
from polar.config import settings
from polar.exceptions import PolarError
from polar.logging import Logger
from polar.worker import enqueue_job

log: Logger = structlog.get_logger()

DEFAULT_FROM_NAME = settings.EMAIL_FROM_NAME
DEFAULT_FROM_EMAIL_ADDRESS = settings.EMAIL_FROM_EMAIL_ADDRESS
DEFAULT_REPLY_TO_NAME = "Polar Support"
DEFAULT_REPLY_TO_EMAIL_ADDRESS = "support@polar.sh"


def to_ascii_email(email: str) -> str:
    """
    Convert an email address to ASCII format, possibly using punycode for internationalized domains.
    """
    validated_email = validate_email(email, check_deliverability=False)
    return validated_email.ascii_email or email


class EmailSenderError(PolarError): ...


class SendEmailError(EmailSenderError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class EmailSender(ABC):
    @abstractmethod
    async def send(
        self,
        *,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = DEFAULT_FROM_NAME,
        from_email_addr: str = DEFAULT_FROM_EMAIL_ADDRESS,
        email_headers: dict[str, str] = {},
        reply_to_name: str | None = DEFAULT_REPLY_TO_NAME,
        reply_to_email_addr: str | None = DEFAULT_REPLY_TO_EMAIL_ADDRESS,
    ) -> None:
        pass


class LoggingEmailSender(EmailSender):
    async def send(
        self,
        *,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = DEFAULT_FROM_NAME,
        from_email_addr: str = DEFAULT_FROM_EMAIL_ADDRESS,
        email_headers: dict[str, str] = {},
        reply_to_name: str | None = DEFAULT_REPLY_TO_NAME,
        reply_to_email_addr: str | None = DEFAULT_REPLY_TO_EMAIL_ADDRESS,
    ) -> None:
        log.info(
            "logging email",
            to_email_addr=to_ascii_email(to_email_addr),
            subject=subject,
            html_content=html_content,
            from_name=from_name,
            from_email_addr=to_ascii_email(from_email_addr),
            email_headers=email_headers,
        )


class ResendEmailSender(EmailSender):
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://api.resend.com",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        )

    async def send(
        self,
        *,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = DEFAULT_FROM_NAME,
        from_email_addr: str = DEFAULT_FROM_EMAIL_ADDRESS,
        email_headers: dict[str, str] = {},
        reply_to_name: str | None = DEFAULT_REPLY_TO_NAME,
        reply_to_email_addr: str | None = DEFAULT_REPLY_TO_EMAIL_ADDRESS,
    ) -> None:
        to_email_addr_ascii = to_ascii_email(to_email_addr)
        payload: dict[str, Any] = {
            "from": f"{from_name} <{to_ascii_email(from_email_addr)}>",
            "to": [to_email_addr_ascii],
            "subject": subject,
            "html": html_content,
            "headers": email_headers,
        }
        if reply_to_name and reply_to_email_addr:
            payload["reply_to"] = (
                f"{reply_to_name} <{to_ascii_email(reply_to_email_addr)}>"
            )

        try:
            response = await self.client.post("/emails", json=payload)
            response.raise_for_status()
            email = response.json()
        except httpx.HTTPError as e:
            log.warning(
                "resend.send_error",
                to_email_addr=to_email_addr_ascii,
                subject=subject,
                error=e,
            )
            raise SendEmailError(str(e)) from e

        log.info(
            "resend.send",
            to_email_addr=to_email_addr_ascii,
            subject=subject,
            email_id=email["id"],
        )


def enqueue_email(
    to_email_addr: str,
    subject: str,
    html_content: str,
    from_name: str = DEFAULT_FROM_NAME,
    from_email_addr: str = DEFAULT_FROM_EMAIL_ADDRESS,
    email_headers: dict[str, str] = {},
    reply_to_name: str | None = DEFAULT_REPLY_TO_NAME,
    reply_to_email_addr: str | None = DEFAULT_REPLY_TO_EMAIL_ADDRESS,
) -> None:
    enqueue_job(
        "email.send",
        to_email_addr=to_email_addr,
        subject=subject,
        html_content=html_content,
        from_name=from_name,
        from_email_addr=from_email_addr,
        email_headers=email_headers,
        reply_to_name=reply_to_name,
        reply_to_email_addr=reply_to_email_addr,
    )


email_sender: EmailSender
if settings.EMAIL_SENDER == EmailSenderType.resend:
    email_sender = ResendEmailSender()
else:
    # Logging in development
    email_sender = LoggingEmailSender()
