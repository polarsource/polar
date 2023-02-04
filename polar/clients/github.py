from typing import Any

from githubkit import (
    AppAuthStrategy,
    AppInstallationAuthStrategy,
    GitHub,
    TokenAuthStrategy,
    utils,
    webhooks,
)

from polar.config import settings

WebhookEvent = webhooks.types.WebhookEvent


def patch_unset(field: str, payload: dict[str, Any]) -> dict[str, Any]:
    # TODO: Remove this once the following issue is resolved:
    # https://github.com/yanyongyu/githubkit/issues/14
    if payload.get(field) is None:
        payload[field] = utils.UNSET
    return payload


def get_client(access_token: str) -> GitHub[TokenAuthStrategy]:
    return GitHub(access_token)


def get_app_client() -> GitHub[AppAuthStrategy]:
    return GitHub(
        AppAuthStrategy(
            app_id=settings.GITHUB_APP_IDENTIFIER,
            private_key=settings.GITHUB_APP_PRIVATE_KEY,
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
        )
    )


def get_app_installation_client(
    installation_id: int,
) -> GitHub[AppInstallationAuthStrategy]:
    return GitHub(
        AppInstallationAuthStrategy(
            app_id=settings.GITHUB_APP_IDENTIFIER,
            private_key=settings.GITHUB_APP_PRIVATE_KEY,
            installation_id=installation_id,
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
        )
    )


__all__ = [
    "get_client",
    "get_app_client",
    "get_app_installation_client",
    "patch_unset",
    "WebhookEvent",
    "webhooks",
]
