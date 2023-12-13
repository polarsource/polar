from abc import ABC, abstractmethod

import resend
import sendgrid
import structlog
from sendgrid.helpers.mail import Content, Email, Mail, ReplyTo, To

from polar.config import EmailSender as EmailSenderType
from polar.config import settings
from polar.logging import Logger

log: Logger = structlog.get_logger()


class EmailSender(ABC):
    @abstractmethod
    def send_to_user(
        self,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = "Polar",
        from_email_addr: str = "notifications@polar.sh",
        email_headers: dict[str, str] = {},
    ) -> None:
        pass


class LoggingEmailSender(EmailSender):
    def send_to_user(
        self,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = "Polar",
        from_email_addr: str = "notifications@polar.sh",
        email_headers: dict[str, str] = {},
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


class SendgridEmailSender(EmailSender):
    def __init__(self) -> None:
        super().__init__()
        self.sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)

    def send_to_user(
        self,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = "Polar",
        from_email_addr: str = "notifications@polar.sh",  # not used
        email_headers: dict[str, str] = {},  # not used
    ) -> None:
        from_email = Email(email="notifications@polar.sh", name=from_name)
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


class ResendEmailSender(EmailSender):
    def __init__(self) -> None:
        super().__init__()
        resend.api_key = settings.RESEND_API_KEY

    def send_to_user(
        self,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = "Polar",
        from_email_addr: str = "polarsource@posts.polar.sh",
        email_headers: dict[str, str] = {},
    ) -> None:
        params = {
            "from": f"{from_name} <{from_email_addr}>",
            "to": [to_email_addr],
            "subject": subject,
            "html": html_content,
            "headers": email_headers,
        }

        email = resend.Emails.send(params)

        log.info(
            "resend.send",
            to_email_addr=to_email_addr,
            subject=subject,
            email_id=email["id"],
        )


def get_email_sender(type: str = "notification") -> EmailSender:
    # Experimenting with Resend for sending posts
    if settings.RESEND_API_KEY and type == "article":
        return ResendEmailSender()

    # Using sendgrid by default
    if settings.EMAIL_SENDER == EmailSenderType.sendgrid:
        return SendgridEmailSender()

    # Logging in development
    return LoggingEmailSender()
