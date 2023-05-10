from abc import ABC, abstractmethod

import structlog

import sendgrid
from sendgrid.helpers.mail import Email, To, Content, Mail, ReplyTo
from polar.config import settings, EmailSender as EmailSenderType

log = structlog.get_logger()


class EmailSender(ABC):
    @abstractmethod
    def send_to_user(self, to_email_addr: str, subject: str, html_content: str):
        pass


class LoggingEmailSender(EmailSender):
    def send_to_user(self, to_email_addr: str, subject: str, html_content: str):
        log.info(
            "logging email",
            to_email_addr=to_email_addr,
            subject=subject,
            html_content=html_content,
        )
        pass


class SendgridEmailSender(EmailSender):
    def send_to_user(self, to_email_addr: str, subject: str, html_content: str):
        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        from_email = Email(email="notifications@polar.sh", name="Polar")
        to_email = To(to_email_addr)
        content = Content("text/html", content=html_content)
        mail = Mail(from_email, to_email, subject, content)
        mail.reply_to = ReplyTo("support@polar.sh", "Polar Support")
        response = sg.client.mail.send.post(request_body=mail.get())  # type: ignore
        log.info(
            "sendgrid.send",
            to_email_addr=to_email_addr,
            subject=subject,
            email_id=response.headers["X-Message-Id"] or None,
        )


def get_email_sender() -> EmailSender:
    if settings.EMAIL_SENDER == EmailSenderType.sendgrid:
        return SendgridEmailSender()
    return LoggingEmailSender()
