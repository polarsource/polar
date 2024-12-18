import os

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from polar.auth.models import AuthSubject, Subject, is_user
from polar.config import settings

POSTHOG_ID_TAG = "posthog_distinct_id"


def configure_sentry() -> None:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        enable_tracing=False,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        release=os.environ.get("RELEASE_VERSION", "development"),
        server_name=os.environ.get("RENDER_INSTANCE_ID", "localhost"),
        environment=settings.ENV,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
        ],
    )


def set_sentry_user(auth_subject: AuthSubject[Subject]) -> None:
    if is_user(auth_subject):
        user = auth_subject.subject
        sentry_sdk.set_user({"id": str(user.id), "email": user.email})
        sentry_sdk.set_tag(POSTHOG_ID_TAG, user.posthog_distinct_id)
