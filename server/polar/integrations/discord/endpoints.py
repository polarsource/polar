from typing import Any
from uuid import UUID

import structlog
from fastapi import (
    APIRouter,
    Depends,
    Request,
)
from fastapi.responses import RedirectResponse
from httpx_oauth.clients.discord import DiscordOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from polar.auth.dependencies import UserRequiredAuth
from polar.config import settings
from polar.exceptions import ResourceAlreadyExists, Unauthorized
from polar.kit import jwt
from polar.kit.http import get_safe_return_url
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

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
# USER AUTHORIZATION
# -------------------------------------------------------------------------------

discord_user_oauth_client = DiscordOAuth2(
    settings.DISCORD_CLIENT_ID,
    settings.DISCORD_CLIENT_SECRET,
    scopes=["identify", "email", "guilds.join"],
)
oauth2_user_authorize_callback = OAuth2AuthorizeCallback(
    discord_user_oauth_client, route_name="integrations.discord.user_callback"
)


@router.get(
    "/user/authorize",
    name="integrations.discord.user_authorize",
    tags=[Tags.INTERNAL],
)
async def discord_user_authorize(
    request: Request, auth: UserRequiredAuth
) -> RedirectResponse:
    state = {"auth_type": "user", "user_id": str(auth.user.id)}
    encoded_state = jwt.encode(data=state, secret=settings.SECRET)

    authorization_url = await discord_user_oauth_client.get_authorization_url(
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
    if user_id != auth.user.id:
        raise Unauthorized()

    try:
        await discord_user_service.create_oauth_account(session, auth.user, data)
        status = "success"
    except ResourceAlreadyExists:
        status = "already_connected"

    redirect_to = get_safe_return_url(f"/settings?discord_status={status}")
    return RedirectResponse(redirect_to, 303)
