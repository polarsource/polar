from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import Depends, Query, Request
from fastapi.responses import RedirectResponse
from httpx_oauth.oauth2 import GetAccessTokenError

from polar.auth.permission import OrganizationPermission
from polar.authz.dependencies import AuthorizeWebUserRead, AuthorizeWebUserWrite
from polar.authz.service import assert_organization_permission
from polar.config import settings
from polar.exceptions import NotPermitted, ResourceNotFound, Unauthorized
from polar.kit import jwt
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import oauth
from .repository import DiscordGuildConnectionRepository
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
    responses={
        403: {
            "description": "User lacks `products_manage` permission on the organization.",
            "model": NotPermitted.schema(),
        }
    },
)
async def discord_bot_authorize(
    return_to: ReturnTo,
    request: Request,
    auth_subject: AuthorizeWebUserWrite,
    organization_id: Annotated[OrganizationID, Query()],
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    await assert_organization_permission(
        session, auth_subject, organization_id, OrganizationPermission.products_manage
    )

    state = {
        "auth_type": "bot",
        "user_id": str(auth_subject.subject.id),
        "organization_id": str(organization_id),
        "return_to": return_to,
    }

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="discord_oauth")

    authorization_url = await oauth.bot_client.get_authorization_url(
        redirect_uri=str(request.url_for("integrations.discord.bot_callback")),
        state=encoded_state,
        extras_params={"permissions": settings.DISCORD_BOT_PERMISSIONS},
    )
    return RedirectResponse(authorization_url, 303)


@router.get("/bot/callback", name="integrations.discord.bot_callback")
async def discord_bot_callback(
    auth_subject: AuthorizeWebUserWrite,
    request: Request,
    state: str,
    session: AsyncSession = Depends(get_db_session),
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

    repository = DiscordGuildConnectionRepository.from_session(session)
    await repository.create_if_absent(
        UUID(decoded_state["organization_id"]), guild_id, auth_subject.subject.id
    )

    redirect_url = get_safe_return_url(
        add_query_parameters(return_to, guild_id=guild_id)
    )

    return RedirectResponse(redirect_url, 303)


###############################################################################
# API
###############################################################################


@router.get(
    "/guild/lookup",
    response_model=DiscordGuild,
    responses={
        403: {
            "description": "User lacks `products_read` permission on the organization.",
            "model": NotPermitted.schema(),
        },
        404: {
            "description": "The organization has not connected this Discord server.",
            "model": ResourceNotFound.schema(),
        },
    },
)
async def discord_guild_lookup(
    guild_id: str,
    organization_id: Annotated[OrganizationID, Query()],
    auth_subject: AuthorizeWebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> DiscordGuild:
    await assert_organization_permission(
        session, auth_subject, organization_id, OrganizationPermission.products_read
    )

    repository = DiscordGuildConnectionRepository.from_session(session)
    connection = await repository.get_by_organization_and_guild(
        organization_id, guild_id
    )
    if connection is None:
        raise ResourceNotFound()

    return await discord_bot_service.get_guild(guild_id)
