import logging.config
import uuid
from typing import Any

import structlog
from logfire.integrations.structlog import LogfireProcessor

from polar.config import settings

Logger = structlog.stdlib.BoundLogger


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


def generate_correlation_id() -> str:
    return str(uuid.uuid4())
