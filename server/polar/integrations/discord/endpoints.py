from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.config import settings
from polar.exceptions import ResourceAlreadyExists, Unauthorized
from polar.kit import jwt
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import oauth
from .service import discord_bot as discord_bot_service
from .service import discord_user as discord_user_service

log = structlog.get_logger()

router = APIRouter(prefix="/integrations/discord", tags=["integrations"])


###############################################################################
# OAUTH2
###############################################################################


def get_decoded_token_state(
    access_token_state: tuple[OAuth2Token, str | None],
) -> tuple[OAuth2Token, dict[str, Any]]:
    token_data, state = access_token_state
    if not state:
        raise Unauthorized("No state")

    try:
        state_data = jwt.decode(token=state, secret=settings.SECRET)
    except jwt.DecodeError as e:
        raise Unauthorized("Invalid state") from e

    return (token_data, state_data)


# -------------------------------------------------------------------------------
# BOT
# -------------------------------------------------------------------------------

oauth2_bot_authorize_callback = OAuth2AuthorizeCallback(
    oauth.bot_client, route_name="integrations.discord.bot_callback"
)


@router.get(
    "/bot/authorize",
    name="integrations.discord.bot_authorize",
    tags=[Tags.INTERNAL],
)
async def discord_bot_authorize(
    return_to: ReturnTo, request: Request, auth: UserRequiredAuth
) -> RedirectResponse:
    state = {"auth_type": "bot", "user_id": str(auth.user.id), "return_to": return_to}

    encoded_state = jwt.encode(data=state, secret=settings.SECRET)

    authorization_url = await oauth.bot_client.get_authorization_url(
        redirect_uri=str(request.url_for("integrations.discord.bot_callback")),
        state=encoded_state,
        extras_params=dict(
            permissions=settings.DISCORD_BOT_PERMISSIONS,
        ),
    )
    return RedirectResponse(authorization_url, 303)


@router.get(
    "/bot/callback", name="integrations.discord.bot_callback", tags=[Tags.INTERNAL]
)
async def discord_bot_callback(
    auth: UserRequiredAuth,
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_bot_authorize_callback
    ),
) -> RedirectResponse:
    data, state = get_decoded_token_state(access_token_state)

    user_id = UUID(state["user_id"])
    if user_id != auth.user.id or state["auth_type"] != "bot":
        raise Unauthorized()

    guild_id = data["guild"]["id"]

    # We need to set this ID on a subsequent API call (e.g. create Discord benefit).
    # To make sure a malicious user won't arbitrarily set guild IDs, we pass it as
    # a signed JWT token.
    guild_token = jwt.encode(data={"guild_id": guild_id}, secret=settings.SECRET)

    return_to = state["return_to"]
    redirect_url = get_safe_return_url(
        add_query_parameters(return_to, guild_token=guild_token, guild_id=guild_id)
    )

    return RedirectResponse(redirect_url, 303)


# -------------------------------------------------------------------------------
# USER AUTHORIZATION
# -------------------------------------------------------------------------------

oauth2_user_authorize_callback = OAuth2AuthorizeCallback(
    oauth.user_client, route_name="integrations.discord.user_callback"
)


@router.get(
    "/user/authorize",
    name="integrations.discord.user_authorize",
    tags=[Tags.INTERNAL],
)
async def discord_user_authorize(
    return_to: ReturnTo, request: Request, auth: UserRequiredAuth
) -> RedirectResponse:
    state = {"auth_type": "user", "user_id": str(auth.user.id), "return_to": return_to}
    encoded_state = jwt.encode(data=state, secret=settings.SECRET)

    authorization_url = await oauth.user_client.get_authorization_url(
        redirect_uri=str(request.url_for("integrations.discord.user_callback")),
        state=encoded_state,
    )
    return RedirectResponse(authorization_url, 303)


@router.get(
    "/user/callback", name="integrations.discord.user_callback", tags=[Tags.INTERNAL]
)
async def discord_user_callback(
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_user_authorize_callback
    ),
) -> RedirectResponse:
    data, state = get_decoded_token_state(access_token_state)

    user_id = UUID(state["user_id"])
    if user_id != auth.user.id or state["auth_type"] != "user":
        raise Unauthorized()

    try:
        await discord_user_service.create_oauth_account(session, auth.user, data)
    except ResourceAlreadyExists:
        pass

    redirect_to = get_safe_return_url(state["return_to"])
    return RedirectResponse(redirect_to, 303)


###############################################################################
# API
###############################################################################


@router.get(
    "/guild/lookup",
    response_model=dict[str, Any],
    tags=[Tags.INTERNAL],
    dependencies=[Depends(Auth.current_user)],
)
async def discord_guild_lookup(guild_token: str) -> dict[str, Any]:
    try:
        guild_token_data = jwt.decode(token=guild_token, secret=settings.SECRET)
        guild_id = guild_token_data["guild_id"]
    except (KeyError, jwt.DecodeError, jwt.ExpiredSignatureError) as e:
        raise Unauthorized() from e

    return await discord_bot_service.get_guild(guild_id)
