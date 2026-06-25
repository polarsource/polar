import contextvars
import logging
import logging.config
import sys
import typing
import uuid
from typing import Any

import structlog
from logfire.integrations.structlog import LogfireProcessor

from polar.config import settings

Logger = structlog.stdlib.BoundLogger


class VercelLoggingHandler(logging.Handler):
    """Route WARNING+ to stderr, everything else to stdout"""

    def __init__(self, level: int = logging.NOTSET) -> None:
        super().__init__(level)
        self._stdout = logging.StreamHandler(sys.stdout)
        self._stderr = logging.StreamHandler(sys.stderr)

    def setFormatter(self, fmt: logging.Formatter | None) -> None:
        super().setFormatter(fmt)
        self._stdout.setFormatter(fmt)
        self._stderr.setFormatter(fmt)

    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno >= logging.WARNING:
            self._stderr.emit(record)
        else:
            self._stdout.emit(record)


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
        # On Vercel route info/debug to stdout and warnings/errors to stderr so
        # only the latter show as [error] in the dashboard.
        handler_class = (
            "polar.logging.VercelLoggingHandler"
            if settings.is_vercel()
            else "logging.StreamHandler"
        )
        logging.config.dictConfig(
            {
                "version": 1,
                "disable_existing_loggers": True,
                "formatters": {
                    "polar": {
                        "()": structlog.stdlib.ProcessorFormatter,
                        "processors": [
                            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
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
                        "class": handler_class,
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
