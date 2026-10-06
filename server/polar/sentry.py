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
from polar.observability.http_telemetry import url_without_request_values

if TYPE_CHECKING:
    from sentry_sdk._types import Event, Hint

POSTHOG_ID_TAG = "posthog_distinct_id"
# Personal data, secrets, and merchant-supplied values on request bodies.
# IP addresses and user agents are kept.
_REQUEST_PII_KEYS = frozenset(
    {
        "access_token",
        "account_email",
        "account_username",
        "api_key",
        "billing_address",
        "billing_manager_email",
        "billing_name",
        "client_secret",
        "code",
        "customer_billing_address",
        "customer_billing_name",
        "customer_email",
        "customer_external_id",
        "customer_name",
        "customer_tax_id",
        "date_of_birth",
        "email",
        "expo_push_token",
        "external_customer_id",
        "external_id",
        "first_name",
        "from_email_addr",
        "full_name",
        "invitation_token",
        "invited_email",
        "inviter_email",
        "last_name",
        "metadata",
        "name",
        "new_email",
        "owner_email",
        "refresh_token",
        "reply_to_email_addr",
        "reply_to_name",
        "secret",
        "session_token",
        "signing_secret",
        "tax_id",
        "to_email_addr",
        "token",
        "turnstile_token",
        "verified_first_name",
        "verified_last_name",
    }
)


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


def _scrub_request_pii(value: object) -> None:
    if isinstance(value, dict):
        mapping = cast(dict[object, object], value)
        for key in [
            key for key in mapping if isinstance(key, str) and key in _REQUEST_PII_KEYS
        ]:
            mapping.pop(key, None)
        for item in mapping.values():
            _scrub_request_pii(item)
    elif isinstance(value, list):
        for item in cast(list[object], value):
            _scrub_request_pii(item)


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
        _scrub_request_pii(request.get("data"))
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
