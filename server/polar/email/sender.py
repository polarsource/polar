from abc import ABC, abstractmethod

import sendgrid
import structlog
from sendgrid.helpers.mail import Content, Email, Mail, ReplyTo, To

from polar.config import EmailSender as EmailSenderType
from polar.config import settings
from polar.logging import Logger

log: Logger = structlog.get_logger()


class EmailSender(ABC):
    @abstractmethod
    def send_to_user(self, to_email_addr: str, subject: str, html_content: str) -> None:
        pass


class LoggingEmailSender(EmailSender):
    def send_to_user(self, to_email_addr: str, subject: str, html_content: str) -> None:
        log.info(
            "logging email",
            to_email_addr=to_email_addr,
            subject=subject,
            html_content=html_content,
        )


class SendgridEmailSender(EmailSender):
    def __init__(self) -> None:
        super().__init__()
        self.sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)

    def send_to_user(self, to_email_addr: str, subject: str, html_content: str) -> None:
        from_email = Email(email="notifications@polar.sh", name="Polar")
        to_email = To(to_email_addr)
        content = Content("text/html", content=html_content)
        mail = Mail(from_email, to_email, subject, content)
        mail.reply_to = ReplyTo("support@polar.sh", "Polar Support")
        response = self.sg.client.mail.send.post(request_body=mail.get())  # type: ignore
        log.info(
            "sendgrid.send",
            to_email_addr=to_email_addr,
            subject=subject,
            email_id=response.headers.get("X-Message-Id"),  # type: ignore
        )


def get_email_sender() -> EmailSender:
    if settings.EMAIL_SENDER == EmailSenderType.sendgrid:
        return SendgridEmailSender()
    return LoggingEmailSender()
