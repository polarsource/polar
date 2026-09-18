import logging
import os
from typing import TYPE_CHECKING, cast

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
from polar.observability.pii import REDACTED, scrub_event, scrub_value

if TYPE_CHECKING:
    from sentry_sdk._types import Breadcrumb, BreadcrumbHint, Event, Hint

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
    scrubbed = cast("Event", scrub_event(event))
    # Sentry fingerprints control issue grouping, unlike payment fingerprints.
    if "fingerprint" in event:
        scrubbed["fingerprint"] = scrub_value(event["fingerprint"])
    if request := scrubbed.get("request"):
        for key in ("url", "query_string", "cookies", "data"):
            if key in request:
                request[key] = REDACTED
    if breadcrumbs := scrubbed.get("breadcrumbs"):
        values = cast("dict[str, list[Breadcrumb]]", breadcrumbs)["values"]
        scrubbed["breadcrumbs"] = {
            "values": [before_breadcrumb(breadcrumb, {}) for breadcrumb in values]
        }
    return scrubbed


def before_breadcrumb(breadcrumb: Breadcrumb, hint: BreadcrumbHint) -> Breadcrumb:
    scrubbed = scrub_event(breadcrumb)
    if data := scrubbed.get("data"):
        for key in ("url", "from", "to"):
            if key in data:
                data[key] = REDACTED
    return scrubbed


def configure_sentry(*, aws_lambda: bool = False) -> None:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=None,  # `0` still opts in to trace continuation
        profiles_sample_rate=None,
        release=os.environ.get("RELEASE_VERSION", "development"),
        server_name=os.environ.get("RENDER_INSTANCE_ID", "localhost"),
        environment=settings.ENV,
        default_integrations=False,
        auto_enabling_integrations=False,
        before_send=before_send,
        before_breadcrumb=before_breadcrumb,
        send_default_pii=False,
        include_local_variables=False,
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
