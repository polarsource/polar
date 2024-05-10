from typing import Any, cast

import httpx
import structlog

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.integrations.discord.service import DiscordAccountNotConnected
from polar.integrations.discord.service import discord_bot as discord_bot_service
from polar.integrations.discord.service import discord_user as discord_user_service
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import BenefitDiscord, BenefitDiscordProperties
from polar.notifications.notification import (
    BenefitPreconditionErrorNotificationContextualPayload,
)

from .base import (
    BenefitPreconditionError,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()

precondition_error_subject_template = (
    "Action required: get access to {organization_name}'s Discord server"
)
precondition_error_body_template = """
<h1>Hi,</h1>
<p>You just subscribed to <strong>{scope_name}</strong> from {organization_name}. Thank you!</p>
<p>As you may know, it includes an access to a private Discord server. To grant you access, we need you to link your Discord account on Polar.</p>
<p>Once done, you'll automatically be added to {organization_name}'s Discord server.</p>
<!-- Action -->
<table class="body-action" align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
        <td align="center">
            <!-- Border based button
https://litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                <tr>
                    <td align="center">
                        <a href="{extra_context[url]}" class="f-fallback button">Link Discord account</a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
<!-- Sub copy -->
<table class="body-sub" role="presentation">
    <tr>
        <td>
            <p class="f-fallback sub">If you're having trouble with the button above, copy and paste the URL below into
                your web browser.</p>
            <p class="f-fallback sub"><a href="{extra_context[url]}">{extra_context[url]}</a></p>
        </td>
    </tr>
</table>
"""


class BenefitDiscordService(
    BenefitServiceProtocol[BenefitDiscord, BenefitDiscordProperties]
):
    async def grant(
        self,
        benefit: BenefitDiscord,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            user_id=str(user.id),
        )
        bound_logger.debug("Grant benefit")

        guild_id = benefit.properties["guild_id"]
        role_id = benefit.properties["role_id"]

        # If we already granted this benefit, make sure we revoke the previous config
        if update and grant_properties:
            bound_logger.debug("Grant benefit update")
            previous_guild_id = grant_properties["guild_id"]
            previous_role_id = grant_properties["role_id"]
            if previous_guild_id != guild_id or previous_role_id != role_id:
                bound_logger.debug(
                    "Revoke before granting because guild or role have changed"
                )
                await self.revoke(benefit, user, grant_properties, attempt=attempt)

        try:
            account = await discord_user_service.get_oauth_account(self.session, user)
        except DiscordAccountNotConnected as e:
            raise BenefitPreconditionError(
                "Discord account not linked",
                payload=BenefitPreconditionErrorNotificationContextualPayload(
                    subject_template=precondition_error_subject_template,
                    body_template=precondition_error_body_template,
                    extra_context={"url": settings.generate_frontend_url("/settings")},
                ),
            ) from e

        try:
            await discord_bot_service.add_member(self.session, guild_id, role_id, user)
        except httpx.HTTPError as e:
            error_bound_logger = bound_logger.bind(error=str(e))
            if isinstance(e, httpx.HTTPStatusError):
                error_bound_logger = error_bound_logger.bind(
                    status_code=e.response.status_code, body=e.response.text
                )
            error_bound_logger.warning("HTTP error while adding member")
            raise BenefitRetriableError(5 * 2**attempt) from e

        bound_logger.debug("Benefit granted")

        # Store guild, role and account IDs as it may change for various reasons:
        # * The benefit is updated
        # * The user disconnects or changes their Discord account
        return {
            "guild_id": guild_id,
            "role_id": role_id,
            "account_id": account.account_id,
        }

    async def revoke(
        self,
        benefit: BenefitDiscord,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            user_id=str(user.id),
        )

        guild_id = grant_properties["guild_id"]
        role_id = grant_properties["role_id"]
        account_id = grant_properties["account_id"]

        try:
            await discord_bot_service.remove_member_role(guild_id, role_id, account_id)
        except httpx.HTTPError as e:
            error_bound_logger = bound_logger.bind(error=str(e))
            if isinstance(e, httpx.HTTPStatusError):
                error_bound_logger = error_bound_logger.bind(
                    status_code=e.response.status_code, body=e.response.text
                )
            error_bound_logger.warning("HTTP error while adding member")
            raise BenefitRetriableError(5 * 2**attempt) from e

        bound_logger.debug("Benefit revoked")

        return {}

    async def requires_update(
        self,
        benefit: BenefitDiscord,
        previous_properties: BenefitDiscordProperties,
    ) -> bool:
        new_properties = benefit.properties
        return (
            new_properties["guild_id"] != previous_properties["guild_id"]
            or new_properties["role_id"] != previous_properties["role_id"]
        )

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitDiscordProperties:
        guild_id: str = properties["guild_id"]
        role_id: str = properties["role_id"]

        guild = await discord_bot_service.get_guild(guild_id)
        guild_roles = [role.id for role in guild.roles]

        if role_id not in guild_roles:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "invalid_role",
                        "msg": "This role does not exist on this server.",
                        "loc": ("role_id",),
                        "input": role_id,
                    }
                ]
            )

        if not await discord_bot_service.is_bot_role_above_role(guild_id, role_id):
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "invalid_role_position",
                        "msg": "This role is above the Polar bot role, so Discord won't let our bot grants it. Please reorder them so the Polar bot is above.",
                        "loc": ("role_id",),
                        "input": role_id,
                    }
                ]
            )

        return cast(BenefitDiscordProperties, properties)
