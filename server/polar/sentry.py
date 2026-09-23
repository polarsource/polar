import logging
import os
from typing import TYPE_CHECKING

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
from sentry_sdk.scrubber import DEFAULT_DENYLIST, EventScrubber

from polar.auth.models import AuthSubject, Subject, is_user
from polar.config import settings
from polar.logging import SENSITIVE_LOG_FIELDS, LogScrubBudget, _scrub_log_value

if TYPE_CHECKING:
    from sentry_sdk._types import Event, Hint

POSTHOG_ID_TAG = "posthog_distinct_id"


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


def before_send(event: Event, hint: Hint) -> Event | None:
    tags = event.get("tags", {})
    if tags and tags.get("is_operational_error") == "true":
        return None
    budget = LogScrubBudget()
    exceptions = event.get("exception")
    if exceptions is not None:
        for exception in reversed(exceptions.get("values", [])):
            value = exception.get("value")
            if isinstance(value, str):
                exception["value"] = budget.scrub_text(value)
    message = event.get("message")
    if isinstance(message, str):
        event["message"] = budget.scrub_text(message)
    logentry = event.get("logentry")
    if logentry is not None:
        scrubbed = _scrub_log_value(
            {key: value for key, value in logentry.items() if key != "params"},
            budget=budget,
        )
        event["logentry"] = (
            scrubbed if isinstance(scrubbed, dict) else {"formatted": scrubbed}
        )
    breadcrumbs = event.get("breadcrumbs")
    if isinstance(breadcrumbs, dict):
        for breadcrumb in breadcrumbs.get("values", []):
            message = breadcrumb.get("message")
            if isinstance(message, str):
                breadcrumb["message"] = budget.scrub_text(message)
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
        send_default_pii=False,
        event_scrubber=EventScrubber(
            denylist=[*DEFAULT_DENYLIST, *SENSITIVE_LOG_FIELDS],
            recursive=True,
        ),
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
