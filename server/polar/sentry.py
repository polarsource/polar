import sentry_sdk
from polar.config import settings
import os
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration


def configure_sentry():
    if not settings.SENTRY_DSN:
        return

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        release=os.environ.get("RENDER_GIT_COMMIT", "development"),
        server_name=os.environ.get("RENDER_INSTANCE_ID", "localhost"),
        environment="production" if os.environ.get("RENDER", False) else "development",
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
    )
