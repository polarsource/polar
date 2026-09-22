import contextvars
import logging.config
import re
import typing
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import structlog
from logfire.integrations.structlog import LogfireProcessor

from polar.config import settings

Logger = structlog.stdlib.BoundLogger

REDACTED = "[Redacted]"
SENSITIVE_LOG_FIELDS = dict.fromkeys(
    (
        "url",
        "email",
        "customer_email",
        "user_email",
        "owner_email",
        "billing_email",
        "old_email",
        "new_email",
        "previous_email",
        "to_email_addr",
        "from_email_addr",
        "reply_to_email_addr",
        "name",
        "full_name",
        "first_name",
        "last_name",
        "billing_name",
        "customer_name",
        "owner_name",
        "from_name",
        "reply_to_name",
        "username",
        "account_username",
        "phone",
        "phone_number",
        "address",
        "billing_address",
        "shipping_address",
        "line1",
        "line2",
        "postal_code",
        "zip",
        "ip",
        "ip_address",
        "client_ip",
        "ssn",
        "social_security",
        "tax_id",
        "date_of_birth",
        "dob",
        "card_number",
        "pan",
        "cvv",
        "cvc",
        "iban",
        "account_number",
        "routing_number",
        "fingerprint",
        "processor_id",
        "password",
        "passwd",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "invitation_token",
        "api_key",
        "authorization",
        "cookie",
        "session",
        "jwt",
        "credential",
        "private_key",
    ),
    REDACTED,
)
_SAFE_LOG_FIELDS = frozenset({"service_name", "logger_name"})
_SQL_FIELDS = frozenset({"db.statement", "db.query.text"})
_MAX_LOG_TEXT_LENGTH = 32_768
_MAX_LOG_CONTAINER_LENGTH = 1_000
_MAX_LOG_DEPTH = 32

_LOG_VALUE_PATTERNS = (
    r"(?<![\w.%+\-])[A-Z0-9._%+\-]{1,64}+@[A-Z0-9.\-]{1,253}+",
    r"\b(?:Bearer|Basic)\s++[^\s,;\"']++",
    r"(?<![A-Z0-9_\-])eyJ[A-Z0-9_\-]++\.[A-Z0-9_\-]++\.[A-Z0-9_\-]++",
    r"\b(?:(?:sk|rk)_(?:live|test)_|whsec_)[A-Z0-9]++",
    r"(?<![\w-])(?:[0-9][ -]?){12,18}[0-9](?![\w-])",
    r"(?<!\w)[A-Z]{2}[0-9]{2}(?: ?[A-Z0-9]){11,30}(?!\w)",
    (
        r"\b(?:password|passwd|secret|token|access_token|refresh_token|api_key|"
        r"authorization|cookie|session|jwt|credential|private_key)"
        r"[\"']?\s{0,16}[:=]\s{0,16}"
        r"(?:\"[^\"\r\n]*+\"|'[^'\r\n]*+'|[^\s,;&}\]]++)"
    ),
    r"\b[a-z][a-z0-9+.\-]{0,20}://[^/\s:@]++:[^/\s@]++@",
)
_LOG_VALUE_RE = re.compile("|".join(_LOG_VALUE_PATTERNS), re.IGNORECASE)


def scrub_log_text(value: str, *, preserve_oversized: bool = False) -> str:
    if len(value) > _MAX_LOG_TEXT_LENGTH:
        return value if preserve_oversized else REDACTED
    return _LOG_VALUE_RE.sub(REDACTED, value)


@dataclass(slots=True)
class LogScrubBudget:
    remaining_values: int = _MAX_LOG_CONTAINER_LENGTH
    remaining_text: int = 4 * _MAX_LOG_TEXT_LENGTH

    def scrub_text(self, value: str) -> str:
        self.remaining_text -= len(value)
        if self.remaining_text < 0:
            return REDACTED
        return scrub_log_text(value)


def _scrub_log_value(value: Any, *, budget: LogScrubBudget, depth: int = 0) -> Any:
    budget.remaining_values -= 1
    if depth >= _MAX_LOG_DEPTH or budget.remaining_values < 0:
        return REDACTED
    if isinstance(value, str):
        return budget.scrub_text(value)
    if isinstance(value, bytes):
        if len(value) > _MAX_LOG_TEXT_LENGTH:
            return REDACTED
        return budget.scrub_text(value.decode("utf-8", errors="replace"))
    if isinstance(value, Mapping):
        if len(value) > _MAX_LOG_CONTAINER_LENGTH:
            return REDACTED
        result = {}
        for key, item in value.items():
            if budget.remaining_values <= 0:
                return REDACTED
            key = str(key)
            normalized = key.lower().replace("-", "_")
            flattened = normalized.replace(".", "_")
            replacement = None
            if flattened not in _SAFE_LOG_FIELDS:
                replacement = (
                    SENSITIVE_LOG_FIELDS.get(normalized)
                    or SENSITIVE_LOG_FIELDS.get(flattened)
                    or SENSITIVE_LOG_FIELDS.get(normalized.rsplit(".", 1)[-1])
                )
            if replacement is not None:
                budget.remaining_values -= 1
                result[key] = replacement
            elif normalized in _SQL_FIELDS and isinstance(item, str):
                budget.remaining_values -= 1
                result[key] = item
            else:
                result[key] = _scrub_log_value(item, budget=budget, depth=depth + 1)
        return result
    if isinstance(value, (list, tuple, set, frozenset)):
        if len(value) > _MAX_LOG_CONTAINER_LENGTH:
            return REDACTED
        items = [
            _scrub_log_value(item, budget=budget, depth=depth + 1) for item in value
        ]
        return tuple(items) if isinstance(value, tuple) else items
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return budget.scrub_text(repr(value))


def _scrub_console_log(
    _logger: logging.Logger, _method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    scrubbed = _scrub_log_value(event_dict, budget=LogScrubBudget())
    return scrubbed if isinstance(scrubbed, dict) else {"event": REDACTED}


def _map_critical_to_fatal(
    logger: logging.Logger, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Map 'critical' log level to 'fatal' for logfire compatibility.

    Logfire expects 'fatal' instead of Python's standard 'critical' level.
    """
    if event_dict.get("level") == "critical":
        event_dict["level"] = "fatal"
    return event_dict


class Logging[RendererType]:
    """Hubben logging configurator of `structlog` and `logging`.

    Customized implementation inspired by the following documentation:
    https://www.structlog.org/en/stable/standard-library.html#rendering-using-structlog-based-formatters-within-logging

    """

    timestamper = structlog.processors.TimeStamper(fmt="iso")

    @classmethod
    def get_level(cls) -> str:
        return settings.LOG_LEVEL

    @classmethod
    def get_processors(cls, *, logfire: bool) -> list[Any]:
        return [
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.PositionalArgumentsFormatter(),
            cls.timestamper,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.StackInfoRenderer(),
            *([_map_critical_to_fatal, LogfireProcessor()] if logfire else []),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ]

    @classmethod
    def get_renderer(cls) -> RendererType:
        raise NotImplementedError()

    @classmethod
    def configure_stdlib(cls, *, logfire: bool) -> None:
        level = cls.get_level()
        logging.config.dictConfig(
            {
                "version": 1,
                "disable_existing_loggers": True,
                "formatters": {
                    "polar": {
                        "()": structlog.stdlib.ProcessorFormatter,
                        "processors": [
                            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                            structlog.processors.format_exc_info,
                            _scrub_console_log,
                            cls.get_renderer(),
                        ],
                        "foreign_pre_chain": [
                            structlog.contextvars.merge_contextvars,
                            structlog.stdlib.add_log_level,
                            structlog.stdlib.add_logger_name,
                            structlog.stdlib.PositionalArgumentsFormatter(),
                            structlog.stdlib.ExtraAdder(),
                            cls.timestamper,
                            structlog.processors.UnicodeDecoder(),
                            structlog.processors.StackInfoRenderer(),
                            *(
                                [_map_critical_to_fatal, LogfireProcessor()]
                                if logfire
                                else []
                            ),
                        ],
                    },
                },
                "handlers": {
                    "default": {
                        "level": level,
                        "class": "logging.StreamHandler",
                        "formatter": "polar",
                    },
                },
                "loggers": {
                    "": {
                        "handlers": ["default"],
                        "level": level,
                        "propagate": False,
                    },
                    # Propagate third-party loggers to the root one
                    **{
                        logger: {
                            "handlers": [],
                            "propagate": True,
                        }
                        for logger in [
                            "uvicorn",
                            "sqlalchemy",
                            "dramatiq",
                            "authlib",
                            "logfire",
                            "apscheduler",
                            "reauth",
                        ]
                    },
                },
            }
        )

    @classmethod
    def configure_structlog(cls, *, logfire: bool = False) -> None:
        structlog.configure_once(
            processors=cls.get_processors(logfire=logfire),
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )

    @classmethod
    def configure(cls, *, logfire: bool = False) -> None:
        cls.configure_stdlib(logfire=logfire)
        cls.configure_structlog(logfire=logfire)


class Development(Logging[structlog.dev.ConsoleRenderer]):
    @classmethod
    def get_renderer(cls) -> structlog.dev.ConsoleRenderer:
        return structlog.dev.ConsoleRenderer(colors=True)


class Production(Logging[structlog.processors.JSONRenderer]):
    @classmethod
    def get_renderer(cls) -> structlog.processors.JSONRenderer:
        return structlog.processors.JSONRenderer()


def configure(*, logfire: bool = False) -> None:
    if settings.is_testing():
        Development.configure(logfire=False)
    elif settings.is_development():
        Development.configure(logfire=logfire)
    else:
        Production.configure(logfire=logfire)


class CorrelationID:
    _correlation_id: typing.ClassVar[contextvars.ContextVar[str | None]] = (
        contextvars.ContextVar("polar.correlation_id", default=None)
    )

    @classmethod
    def set(cls) -> str:
        correlation_id = str(uuid.uuid4())
        cls._correlation_id.set(correlation_id)
        return correlation_id

    @classmethod
    def get(cls) -> str | None:
        return cls._correlation_id.get()

    @classmethod
    def clear(cls) -> None:
        cls._correlation_id.set(None)


class ClientContext:
    """Mobile client identification headers for the current request,
    so they can be attached to events emitted outside the logging
    path — notably PostHog. Empty outside an HTTP request (e.g. workers)."""

    _client_context: typing.ClassVar[contextvars.ContextVar[dict[str, str] | None]] = (
        contextvars.ContextVar("polar.client_context", default=None)
    )

    @classmethod
    def set(cls, context: dict[str, str]) -> None:
        cls._client_context.set(context)

    @classmethod
    def get(cls) -> dict[str, str]:
        return cls._client_context.get() or {}

    @classmethod
    def clear(cls) -> None:
        cls._client_context.set(None)
