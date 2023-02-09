from typing import Any

from fastapi.encoders import jsonable_encoder
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


# TODO: Investigate improvement from githubkit - this is not ergonomic or pretty..


def is_set(obj: object, name: str) -> bool:
    attr = getattr(obj, name, None)
    if attr is None:
        return False
    return not isinstance(attr, utils.Unset)


def jsonify(obj: Any) -> list[dict[str, Any]] | dict[str, Any] | None:
    if not obj:
        return None

    if isinstance(obj, list):
        return [jsonable_encoder(utils.exclude_unset(o.dict())) for o in obj]
    return jsonable_encoder(utils.exclude_unset(obj.dict()))


def attr(obj: object, attr: str) -> Any:
    if is_set(obj, attr):
        return getattr(obj, attr)
    return None


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
