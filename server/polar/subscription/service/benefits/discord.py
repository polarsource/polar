from typing import Any

import httpx
import structlog

from polar.integrations.discord.service import DiscordAccountNotConnected
from polar.integrations.discord.service import discord_bot as discord_bot_service
from polar.integrations.discord.service import discord_user as discord_user_service
from polar.logging import Logger
from polar.models import Subscription, User
from polar.models.subscription_benefit import (
    SubscriptionBenefitDiscord,
    SubscriptionBenefitDiscordProperties,
)

from .base import (
    SubscriptionBenefitPreconditionError,
    SubscriptionBenefitRetriableError,
    SubscriptionBenefitServiceProtocol,
)

log: Logger = structlog.get_logger()


class SubscriptionBenefitDiscordService(
    SubscriptionBenefitServiceProtocol[
        SubscriptionBenefitDiscord, SubscriptionBenefitDiscordProperties
    ]
):
    async def grant(
        self,
        benefit: SubscriptionBenefitDiscord,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            subscription_id=str(subscription.id),
            user_id=str(user.id),
        )
        bound_logger.debug("Grant benefit")

        guild_id = benefit.properties["guild_id"]
        role_id = benefit.properties["role_id"]

        # If we already granted this benefit, make sure we revoke the previous config
        if update:
            bound_logger.debug("Grant benefit update")
            previous_guild_id = grant_properties["guild_id"]
            previous_role_id = grant_properties["role_id"]
            if previous_guild_id != guild_id or previous_role_id != role_id:
                bound_logger.debug(
                    "Revoke before granting because guild or role have changed"
                )
                await self.revoke(
                    benefit, subscription, user, grant_properties, attempt=attempt
                )

        try:
            account = await discord_user_service.get_oauth_account(self.session, user)
        except DiscordAccountNotConnected as e:
            # TODO: Notify user & delay retry
            raise SubscriptionBenefitPreconditionError(
                "Discord account not linked"
            ) from e

        try:
            await discord_bot_service.add_member(self.session, guild_id, role_id, user)
        except httpx.HTTPError as e:
            raise SubscriptionBenefitRetriableError(2**attempt)

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
        benefit: SubscriptionBenefitDiscord,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            subscription_id=str(subscription.id),
            user_id=str(user.id),
        )

        guild_id = grant_properties["guild_id"]
        role_id = grant_properties["role_id"]
        account_id = grant_properties["account_id"]

        try:
            await discord_bot_service.remove_member_role(guild_id, role_id, account_id)
        except httpx.HTTPError as e:
            raise SubscriptionBenefitRetriableError(2**attempt)

        bound_logger.debug("Benefit revoked")

        return {}

    async def requires_update(
        self,
        benefit: SubscriptionBenefitDiscord,
        previous_properties: SubscriptionBenefitDiscordProperties,
    ) -> bool:
        new_properties = benefit.properties
        return (
            new_properties["guild_id"] != previous_properties["guild_id"]
            or new_properties["role_id"] != previous_properties["role_id"]
        )
