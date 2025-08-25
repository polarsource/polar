from typing import Any
from uuid import UUID

import structlog
from fastapi import Request
from fastapi.responses import RedirectResponse
from httpx_oauth.oauth2 import GetAccessTokenError

from polar.auth.dependencies import WebUserWrite
from polar.config import settings
from polar.exceptions import Unauthorized
from polar.kit import jwt
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.openapi import APITag
from polar.routing import APIRouter

from . import oauth
from .schemas import DiscordGuild
from .service import discord_bot as discord_bot_service

log = structlog.get_logger()

router = APIRouter(
    prefix="/integrations/discord",
    tags=["integrations_discord", APITag.private],
)


###############################################################################
# OAUTH2
###############################################################################


def get_decoded_token_state(state: str) -> dict[str, Any]:
    try:
        state_data = jwt.decode(
            token=state,
            secret=settings.SECRET,
            type="discord_oauth",
        )
    except jwt.DecodeError as e:
        raise Unauthorized("Invalid state") from e

    return state_data


# -------------------------------------------------------------------------------
# BOT
# -------------------------------------------------------------------------------


@router.get(
    "/bot/authorize",
    name="integrations.discord.bot_authorize",
)
async def discord_bot_authorize(
    return_to: ReturnTo, request: Request, auth_subject: WebUserWrite
) -> RedirectResponse:
    state = {
        "auth_type": "bot",
        "user_id": str(auth_subject.subject.id),
        "return_to": return_to,
    }

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="discord_oauth")

    authorization_url = await oauth.bot_client.get_authorization_url(
        redirect_uri=str(request.url_for("integrations.discord.bot_callback")),
        state=encoded_state,
        extras_params=dict(
            permissions=settings.DISCORD_BOT_PERMISSIONS,
        ),
    )
    return RedirectResponse(authorization_url, 303)


@router.get("/bot/callback", name="integrations.discord.bot_callback")
async def discord_bot_callback(
    auth_subject: WebUserWrite,
    request: Request,
    state: str,
    code: str | None = None,
    code_verifier: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    decoded_state = get_decoded_token_state(state)
    return_to = decoded_state["return_to"]
    if code is None or error is not None:
        redirect_url = get_safe_return_url(
            add_query_parameters(
                return_to, error=error or "Failed to authorize Discord bot."
            )
        )
        return RedirectResponse(redirect_url, 303)

    try:
        access_token = await oauth.bot_client.get_access_token(
            code, str(request.url_for("integrations.discord.bot_callback"))
        )
    except GetAccessTokenError as e:
        redirect_url = get_safe_return_url(
            add_query_parameters(
                return_to, error="Failed to get access token. Please try again later."
            )
        )
        log.error("Failed to get Discord bot access token", error=str(e))
        return RedirectResponse(redirect_url, 303)

    user_id = UUID(decoded_state["user_id"])
    if user_id != auth_subject.subject.id or decoded_state["auth_type"] != "bot":
        raise Unauthorized()

    guild_id = access_token["guild"]["id"]

    # We need to set this ID on a subsequent API call (e.g. create Discord benefit).
    # To make sure a malicious user won't arbitrarily set guild IDs, we pass it as
    # a signed JWT token.
    guild_token = jwt.encode(
        data={"guild_id": guild_id},
        secret=settings.SECRET,
        type="discord_guild_token",
    )

    redirect_url = get_safe_return_url(
        add_query_parameters(return_to, guild_token=guild_token, guild_id=guild_id)
    )

    return RedirectResponse(redirect_url, 303)


###############################################################################
# API
###############################################################################


@router.get("/guild/lookup", response_model=DiscordGuild)
async def discord_guild_lookup(
    guild_token: str, auth_subject: WebUserWrite
) -> DiscordGuild:
    try:
        guild_token_data = jwt.decode(
            token=guild_token,
            secret=settings.SECRET,
            type="discord_guild_token",
        )
        guild_id = guild_token_data["guild_id"]
    except (KeyError, jwt.DecodeError, jwt.ExpiredSignatureError) as e:
        raise Unauthorized() from e

    return await discord_bot_service.get_guild(guild_id)
