from abc import ABC, abstractmethod

import structlog


class EmailSender(ABC):
    @abstractmethod
    def send_to_user(self, email: str, content: str):
        pass


log = structlog.get_logger()


class LoggingEmailSender(EmailSender):
    def send_to_user(self, email: str, content: str):
        log.info("logging email", email=email, content=content)
        pass
