from typing import Any, cast

import httpx
import structlog
from httpx_oauth.clients.discord import DiscordOAuth2
from httpx_oauth.oauth2 import RefreshTokenError

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.integrations.discord.service import discord_bot as discord_bot_service
from polar.logging import Logger
from polar.models import Benefit, Customer, Organization, User
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform

from ..base.service import (
    BenefitActionRequiredError,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceProtocol,
)
from .properties import BenefitDiscordProperties, BenefitGrantDiscordProperties

log: Logger = structlog.get_logger()


class BenefitDiscordService(
    BenefitServiceProtocol[BenefitDiscordProperties, BenefitGrantDiscordProperties]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantDiscordProperties,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BenefitGrantDiscordProperties:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            customer_id=str(customer.id),
        )
        bound_logger.debug("Grant benefit")

        properties = self._get_properties(benefit)
        guild_id = properties["guild_id"]
        role_id = properties["role_id"]

        # If we already granted this benefit, make sure we revoke the previous config
        if update and grant_properties:
            bound_logger.debug("Grant benefit update")
            previous_guild_id = grant_properties.get("guild_id")
            previous_role_id = grant_properties.get("role_id")
            account_id = grant_properties.get("account_id")
            granted_account_id = grant_properties.get("granted_account_id")
            if (
                (previous_guild_id is not None and previous_guild_id != guild_id)
                or (previous_role_id is not None and previous_role_id != role_id)
                or (granted_account_id is not None and granted_account_id != account_id)
            ):
                bound_logger.debug(
                    "Revoke before granting because guild, role or account have changed"
                )
                await self.revoke(benefit, customer, grant_properties, attempt=attempt)

        if (account_id := grant_properties.get("account_id")) is None:
            raise BenefitActionRequiredError(
                "The customer needs to connect their Discord account"
            )

        oauth_account = await self._get_customer_oauth_account(customer, account_id)

        try:
            await discord_bot_service.add_member(
                guild_id, role_id, oauth_account.account_id, oauth_account.access_token
            )
        except httpx.HTTPError as e:
            error_bound_logger = bound_logger.bind(error=str(e))
            if isinstance(e, httpx.HTTPStatusError):
                error_bound_logger = error_bound_logger.bind(
                    status_code=e.response.status_code, body=e.response.text
                )
            error_bound_logger.warning("HTTP error while adding member")
            raise BenefitRetriableError() from e

        bound_logger.debug("Benefit granted")

        # Store guild, and role as it may change if the benefit is updated
        return {
            **grant_properties,
            "guild_id": guild_id,
            "role_id": role_id,
            "granted_account_id": account_id,
        }

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantDiscordProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantDiscordProperties:
        return grant_properties

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantDiscordProperties,
        *,
        attempt: int = 1,
    ) -> BenefitGrantDiscordProperties:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            customer_id=str(customer.id),
        )

        guild_id = grant_properties.get("guild_id")
        role_id = grant_properties.get("role_id")
        account_id = grant_properties.get("granted_account_id")

        if not (guild_id and role_id and account_id):
            return {}

        properties = self._get_properties(benefit)

        try:
            if properties["kick_member"]:
                await discord_bot_service.remove_member(guild_id, account_id)
            else:
                await discord_bot_service.remove_member_role(
                    guild_id, role_id, account_id
                )
        except httpx.HTTPError as e:
            error_bound_logger = bound_logger.bind(error=str(e))
            if isinstance(e, httpx.HTTPStatusError):
                error_bound_logger = error_bound_logger.bind(
                    status_code=e.response.status_code, body=e.response.text
                )
            error_bound_logger.warning("HTTP error while removing member")
            raise BenefitRetriableError() from e

        bound_logger.debug("Benefit revoked")

        # Keep account_id in case we need to re-grant later
        return {
            "account_id": grant_properties.get("account_id"),
        }

    async def requires_update(
        self, benefit: Benefit, previous_properties: BenefitDiscordProperties
    ) -> bool:
        new_properties = self._get_properties(benefit)
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

    async def _get_customer_oauth_account(
        self, customer: Customer, account_id: str
    ) -> CustomerOAuthAccount:
        oauth_account = customer.get_oauth_account(
            account_id, CustomerOAuthPlatform.discord
        )
        if oauth_account is None:
            raise BenefitActionRequiredError(
                "The customer needs to connect their Discord account"
            )

        if oauth_account.is_expired():
            if oauth_account.refresh_token is None:
                raise BenefitActionRequiredError(
                    "The customer needs to reconnect their Discord account"
                )

            log.debug(
                "Refresh Discord access token",
                oauth_account_id=oauth_account.account_id,
                customer_id=str(customer.id),
            )
            client = DiscordOAuth2(
                settings.DISCORD_CLIENT_ID,
                settings.DISCORD_CLIENT_SECRET,
                scopes=["identify", "email", "guilds.join"],
            )
            try:
                refreshed_token_data = await client.refresh_token(
                    oauth_account.refresh_token
                )
            except RefreshTokenError as e:
                log.warning(
                    "Failed to refresh Discord access token",
                    oauth_account_id=oauth_account.account_id,
                    customer_id=str(customer.id),
                    error=str(e),
                )
                raise BenefitActionRequiredError(
                    "The customer needs to reconnect their Discord account"
                ) from e
            oauth_account.access_token = refreshed_token_data["access_token"]
            oauth_account.expires_at = refreshed_token_data["expires_at"]
            oauth_account.refresh_token = refreshed_token_data["refresh_token"]
            customer.set_oauth_account(oauth_account, CustomerOAuthPlatform.discord)

            customer_repository = CustomerRepository.from_session(self.session)
            await customer_repository.update(customer)

        return oauth_account
