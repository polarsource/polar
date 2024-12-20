from abc import ABC, abstractmethod
from typing import Any

import httpx
import structlog

from polar.config import EmailSender as EmailSenderType
from polar.config import settings
from polar.logging import Logger

log: Logger = structlog.get_logger()

DEFAULT_FROM_NAME = settings.EMAIL_FROM_NAME
DEFAULT_FROM_EMAIL_ADDRESS = settings.EMAIL_FROM_EMAIL_ADDRESS
DEFAULT_REPLY_TO_NAME = "Polar Support"
DEFAULT_REPLY_TO_EMAIL_ADDRESS = "support@polar.sh"


class EmailSender(ABC):
    @abstractmethod
    async def send_to_user(
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
    async def send_to_user(
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
            to_email_addr=to_email_addr,
            subject=subject,
            html_content=html_content,
            from_name=from_name,
            from_email_addr=from_email_addr,
            email_headers=email_headers,
        )


class ResendEmailSender(EmailSender):
    def __init__(self) -> None:
        super().__init__()
        self._api_key = settings.RESEND_API_KEY

    async def send_to_user(
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
        payload: dict[str, Any] = {
            "from": f"{from_name} <{from_email_addr}>",
            "to": [to_email_addr],
            "subject": subject,
            "html": html_content,
            "headers": email_headers,
        }
        if reply_to_name and reply_to_email_addr:
            payload["reply_to"] = f"{reply_to_name} <{reply_to_email_addr}>"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                },
                json=payload,
            )
            response.raise_for_status()
            email = response.json()

        log.info(
            "resend.send",
            to_email_addr=to_email_addr,
            subject=subject,
            email_id=email["id"],
        )


def get_email_sender() -> EmailSender:
    if settings.EMAIL_SENDER == EmailSenderType.resend:
        return ResendEmailSender()

    # Logging in development
    return LoggingEmailSender()
