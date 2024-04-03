import os
from typing import TYPE_CHECKING, Self

import posthog as global_posthog
import sentry_sdk
from fastapi import Depends
from posthog.request import DEFAULT_HOST
from sentry_sdk.hub import Hub
from sentry_sdk.integrations import Integration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.scope import add_global_event_processor
from sentry_sdk.utils import Dsn

from polar.auth.dependencies import Auth, AuthenticatedWithScope
from polar.config import settings
from polar.posthog import posthog

if TYPE_CHECKING:
    from posthog import Posthog
    from sentry_sdk import _types

POSTHOG_ID_TAG = "posthog_distinct_id"


class PostHogIntegration(Integration):
    """
    PostHog integration for Sentry, heavily pulled from the official one from PostHog.

    https://github.com/PostHog/posthog-python/blob/master/posthog/sentry/posthog_integration.py

    The official one suffers from a few limitations:

    * Doesn't have a clean way to set dynamic parameters, like `organization`.
    * Doesn't support a custom instance of PostHog, only the global one.
    * Tries to serialize the Sentry exception object, but fails to do so.

    This implementation tries to solve those limitations to fit our use-case.
    """

    identifier = "posthog-python"

    def __init__(
        self,
        posthog: "Posthog | None" = None,
        organization: str | None = None,
        project_id: str | None = None,
        prefix: str = "https://sentry.io/organizations/",
    ):
        self.posthog = posthog if posthog else global_posthog
        self.organization = organization
        self.project_id = project_id
        self.prefix = prefix

    @staticmethod
    def setup_once() -> None:
        @add_global_event_processor
        def processor(event: "_types.Event", hint: "_types.Hint") -> "_types.Event":
            integration: Self | None = Hub.current.get_integration(PostHogIntegration)
            if integration is not None:
                if event.get("level") != "error":
                    return event

                if event.get("tags", {}).get(POSTHOG_ID_TAG):
                    posthog = integration.posthog

                    posthog_distinct_id = event["tags"][POSTHOG_ID_TAG]

                    # Posthog and Module("Posthog") are not compatible types in Python 3.12 / Mypy 1.7
                    # Adding if/else here as a workaround
                    host = (
                        posthog.host
                        if posthog and isinstance(posthog, Posthog)
                        else global_posthog.host
                    )

                    event["tags"]["PostHog URL"] = (
                        f"{host or DEFAULT_HOST}/person/{posthog_distinct_id}"
                    )

                    properties = {
                        "$sentry_event_id": event["event_id"],
                    }

                    if integration.organization:
                        project_id = integration.project_id
                        if project_id is None:
                            sentry_client = Hub.current.client
                            if (
                                sentry_client is not None
                                and sentry_client.dsn is not None
                            ):
                                project_id = Dsn(sentry_client.dsn).project_id

                        if project_id:
                            properties["$sentry_url"] = (
                                f"{integration.prefix}{integration.organization}"
                                "/issues/"
                                f"?project={project_id}&query={event['event_id']}"
                            )

                    # Posthog and Module("Posthog") are not compatible types in Python 3.12 / Mypy 1.7
                    # Adding if/else here as a workaround
                    if posthog and isinstance(posthog, Posthog):
                        posthog.capture(posthog_distinct_id, "$exception", properties)
                    else:
                        global_posthog.capture(
                            posthog_distinct_id, "$exception", properties
                        )

            return event


def configure_sentry() -> None:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        release=os.environ.get("RENDER_GIT_COMMIT", "development"),
        server_name=os.environ.get("RENDER_INSTANCE_ID", "localhost"),
        environment="production" if os.environ.get("RENDER", False) else "development",
        integrations=[
            PostHogIntegration(posthog=posthog.client, organization="polar-sh"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
    )


async def set_sentry_user(
    auth: Auth = Depends(
        AuthenticatedWithScope(
            allow_anonymous=True,
            fallback_to_anonymous=True,
        )
    ),
) -> None:
    if auth.user is not None:
        sentry_sdk.set_user(
            {
                "id": str(auth.user.id),
                "email": auth.user.email,
            }
        )
        sentry_sdk.set_tag(POSTHOG_ID_TAG, auth.user.posthog_distinct_id)
