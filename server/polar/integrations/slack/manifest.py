import json

from polar.config import settings

_REDIRECT_PATH = "/v1/integrations/slack/callback"
_EVENTS_PATH = "/v1/integrations/slack/events"

BOT_SCOPES = [
    "channels:join",
    "channels:manage",
    "channels:read",
    "groups:read",
    "groups:write",
    "conversations.connect:write",
    "conversations.connect:read",
    "chat:write",
    "team:read",
    "users:read",
]

_BOT_EVENTS = [
    "tokens_revoked",
    "app_uninstalled",
    "channel_shared",
    "channel_id_changed",
]


def generate_manifest(display_name: str) -> str:
    manifest = {
        "display_information": {
            "name": display_name,
            "description": (
                "Provisions Slack Connect channels for paying customers via Polar."
            ),
        },
        "features": {
            "bot_user": {
                "display_name": display_name,
                "always_online": True,
            },
        },
        "oauth_config": {
            "redirect_urls": [settings.generate_external_url(_REDIRECT_PATH)],
            "scopes": {"bot": BOT_SCOPES},
        },
        "settings": {
            "event_subscriptions": {
                "request_url": settings.generate_external_url(_EVENTS_PATH),
                "bot_events": _BOT_EVENTS,
            },
            "interactivity": {"is_enabled": False},
            "org_deploy_enabled": False,
            "socket_mode_enabled": False,
            "token_rotation_enabled": False,
        },
    }
    return json.dumps(manifest, indent=2)
