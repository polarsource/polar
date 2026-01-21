import logging
import os
from typing import TYPE_CHECKING, Any

import sentry_sdk
from dramatiq import get_broker
from sentry_sdk.integrations.argv import ArgvIntegration
from sentry_sdk.integrations.atexit import AtexitIntegration
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

if TYPE_CHECKING:
    import dramatiq
    from sentry_sdk._types import Event, Hint

POSTHOG_ID_TAG = "posthog_distinct_id"

# Tasks that use FOR UPDATE NOWAIT and expect lock failures to trigger retries
_LOCK_EXPECTED_ACTORS: frozenset[str] = frozenset(
    {
        "customer_meter.update_customer",
    }
)


def _is_lock_not_available_error(exc_value: Any) -> bool:
    """Check if the exception is a PostgreSQL lock_not_available error (55P03)."""
    # Check asyncpg LockNotAvailableError directly
    exc_type_name = type(exc_value).__name__
    if exc_type_name == "LockNotAvailableError":
        return True

    # Check SQLAlchemy DBAPIError wrapping asyncpg error
    if exc_type_name == "DBAPIError":
        orig = getattr(exc_value, "orig", None)
        if orig is not None:
            cause = getattr(orig, "__cause__", None)
            if cause is not None and hasattr(cause, "sqlstate"):
                return cause.sqlstate == "55P03"

    return False


def _get_dramatiq_actor_name(event: "Event") -> str | None:
    """Extract actor name from Sentry event's dramatiq context."""
    contexts = event.get("contexts")
    if contexts is None:
        return None
    dramatiq_ctx = contexts.get("dramatiq")
    if dramatiq_ctx is None or not isinstance(dramatiq_ctx, dict):
        return None
    data = dramatiq_ctx.get("data")
    if data is None or not isinstance(data, dict):
        return None
    return data.get("actor_name")


def before_send(event: "Event", hint: "Hint") -> "Event | None":
    """
    Filter out expected exceptions before sending to Sentry.

    Returns None to drop the event, or the event to send it.
    """
    exc_info = hint.get("exc_info")
    if exc_info is not None:
        _, exc_value, _ = exc_info
        # Drop LockNotAvailableError for tasks that expect it (using FOR UPDATE NOWAIT)
        if _is_lock_not_available_error(exc_value):
            actor_name = _get_dramatiq_actor_name(event)
            if actor_name in _LOCK_EXPECTED_ACTORS:
                return None

    return event


class PatchedSentryMiddleware(SentryMiddleware):
    """
    Patched Sentry middleware that makes sure to cleanup its stuff when a message
    is skipped.

    Temporary until the fix is available upstream.
    """

    def after_skip_message(
        self, broker: "dramatiq.Broker", message: "dramatiq.MessageProxy"
    ) -> None:
        return self.after_process_message(broker, message)  # type: ignore


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
        broker.add_middleware(PatchedSentryMiddleware(), before=first_middleware)


def configure_sentry() -> None:
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
        ],
    )


def set_sentry_user(auth_subject: AuthSubject[Subject]) -> None:
    if is_user(auth_subject):
        user = auth_subject.subject
        sentry_sdk.set_user({"id": str(user.id), "email": user.email})
        sentry_sdk.set_tag(POSTHOG_ID_TAG, user.posthog_distinct_id)
