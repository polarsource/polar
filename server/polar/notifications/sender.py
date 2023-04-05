from abc import ABC, abstractmethod

import structlog

log = structlog.get_logger()


class EmailSender(ABC):
    @abstractmethod
    def send_to_user(self, email: str, content: str):
        pass


class LoggingEmailSender(EmailSender):
    def send_to_user(self, email: str, content: str):
        log.info("logging email", email=email, content=content)
        pass


def get_email_sender() -> EmailSender:
    return LoggingEmailSender()
