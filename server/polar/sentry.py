import logging
import os
import re
from typing import TYPE_CHECKING, Any

import sentry_sdk
from dramatiq import get_broker
from sentry_sdk.integrations.argv import ArgvIntegration
from sentry_sdk.integrations.atexit import AtexitIntegration
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration
from sentry_sdk.integrations.dedupe import DedupeIntegration
from sentry_sdk.integrations.dramatiq import DramatiqIntegration as _DramatiqIntegration
from sentry_sdk.integrations.dramatiq import SentryMiddleware
from sentry_sdk.integrations.excepthook import ExcepthookIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.modules import ModulesIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.threading import ThreadingIntegration

from polar.auth.models import AuthSubject, Subject, is_user
from polar.config import settings
from polar.observability.http_telemetry import url_without_request_values

if TYPE_CHECKING:
    from sentry_sdk._types import Event, Hint

POSTHOG_ID_TAG = "posthog_distinct_id"

# Issued credentials are `polar_<prefix>_` plus a 43-character secret. The floor
# stays above ordinary identifiers such as template names.
_POLAR_TOKEN_RE = re.compile(
    r"(?<![A-Za-z0-9])polar_[a-z0-9]+(?:_[a-z0-9]+)*_[A-Za-z0-9]{20,}(?![A-Za-z0-9])"
)
# PostgreSQL unique/foreign-key DETAIL lines embed the offending key values.
_SQL_CONSTRAINT_DETAIL_RE = re.compile(
    r"Key \((?:[^()\n]|\([^()\n]*\))*\)=\((?:[^()\n]|\([^()\n]*\))*\)"
)
_SQL_EXCEPTION_MODULE_PREFIXES = ("sqlalchemy.", "asyncpg.", "psycopg.", "psycopg2.")
_FILTERED = "[Filtered]"


class DramatiqIntegration(_DramatiqIntegration):
    """
    Custom Dramatiq integration to set up Sentry middleware.

    The built-in one expects us to init Sentry before our broker, which is not
    practical in our case.
    """

    @staticmethod
    def setup_once() -> None:
        broker = get_broker()
        first_middleware = type(broker.middleware[0])
        broker.add_middleware(SentryMiddleware(), before=first_middleware)


def _is_sql_exception_module(module: str) -> bool:
    return module.startswith(_SQL_EXCEPTION_MODULE_PREFIXES)


def _event_has_sql_exception(event: Event) -> bool:
    exception = event.get("exception")
    if not isinstance(exception, dict):
        return False
    values = exception.get("values")
    if not isinstance(values, list):
        return False
    for value in values:
        if not isinstance(value, dict):
            continue
        module = value.get("module")
        if isinstance(module, str) and _is_sql_exception_module(module):
            return True
    return False


def _hint_has_sql_exception(hint: Hint) -> bool:
    exc_info = hint.get("exc_info")
    if not isinstance(exc_info, tuple) or len(exc_info) < 2:
        return False
    current = exc_info[1]
    return isinstance(current, BaseException) and _is_sql_exception_module(
        type(current).__module__
    )


def _scrub_text(text: str, *, scrub_constraint_details: bool) -> str:
    if scrub_constraint_details:
        text = _SQL_CONSTRAINT_DETAIL_RE.sub(
            f"Key ({_FILTERED})=({_FILTERED})",
            text,
        )
    return _POLAR_TOKEN_RE.sub(_FILTERED, text)


def _scrub_container(value: Any, *, scrub_constraint_details: bool) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, str):
                value[key] = _scrub_text(
                    item, scrub_constraint_details=scrub_constraint_details
                )
            elif isinstance(item, dict | list):
                _scrub_container(
                    item, scrub_constraint_details=scrub_constraint_details
                )
    elif isinstance(value, list):
        for index, item in enumerate(value):
            if isinstance(item, str):
                value[index] = _scrub_text(
                    item, scrub_constraint_details=scrub_constraint_details
                )
            elif isinstance(item, dict | list):
                _scrub_container(
                    item, scrub_constraint_details=scrub_constraint_details
                )


def before_send(event: Event, hint: Hint) -> Event | None:
    tags = event.get("tags", {})
    if tags and tags.get("is_operational_error") == "true":
        return None
    request = event.get("request")
    if request is not None:
        url = request.get("url")
        if isinstance(url, str):
            request["url"] = url_without_request_values(url)
        request.pop("query_string", None)
        request.pop("fragment", None)
    _scrub_container(
        event,
        scrub_constraint_details=_event_has_sql_exception(event)
        or _hint_has_sql_exception(hint),
    )
    return event


def configure_sentry(*, aws_lambda: bool = False) -> None:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=None,  # `0` still opts in to trace continuation
        profiles_sample_rate=None,
        release=os.environ.get("RELEASE_VERSION", "development"),
        server_name=os.environ.get("RENDER_INSTANCE_ID", "localhost"),
        environment=settings.ENV,
        # Stack frame locals here carry customer, order and payment objects.
        include_local_variables=False,
        default_integrations=False,
        auto_enabling_integrations=False,
        before_send=before_send,
        integrations=[
            AtexitIntegration(),
            ExcepthookIntegration(),
            DedupeIntegration(),
            ModulesIntegration(),
            ArgvIntegration(),
            LoggingIntegration(
                level=logging.INFO,  # Capture info and above as breadcrumbs
                event_level=None,
            ),
            ThreadingIntegration(),
            # Both Starlette and FastAPI integrations are needed
            # See: https://docs.sentry.io/platforms/python/integrations/fastapi/#options
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            DramatiqIntegration(),
            *([AwsLambdaIntegration()] if aws_lambda else []),
        ],
    )


def set_sentry_user(auth_subject: AuthSubject[Subject]) -> None:
    if is_user(auth_subject):
        user = auth_subject.subject
        sentry_sdk.set_user({"id": str(user.id)})
        sentry_sdk.set_tag(POSTHOG_ID_TAG, user.posthog_distinct_id)
