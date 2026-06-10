import secrets
from typing import Any, cast
from uuid import UUID

import httpx
import structlog

from polar.auth.models import AuthSubject
from polar.integrations.slack.client import SlackClient
from polar.integrations.slack.repository import SlackAppRepository
from polar.kit.db.postgres import AsyncSession
from polar.locker import Locker, TimeoutLockError
from polar.logging import Logger
from polar.models import (
    Benefit,
    Customer,
    Member,
    Organization,
    SlackApp,
    User,
)
from polar.redis import Redis

from ..base.service import (
    BenefitActionRequiredError,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceProtocol,
)
from .properties import (
    BenefitGrantSlackSharedChannelProperties,
    BenefitSlackSharedChannelProperties,
)
from .template import (
    InvalidTemplateError,
    TemplateContext,
    render_channel_name,
    validate_template,
)

log: Logger = structlog.get_logger()

_PROVISIONING_LOCK_TTL_SECONDS = 60


class BenefitSlackSharedChannelService(
    BenefitServiceProtocol[
        BenefitSlackSharedChannelProperties,
        BenefitGrantSlackSharedChannelProperties,
    ]
):
    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        super().__init__(session, redis)
        self._client = SlackClient()

    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantSlackSharedChannelProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantSlackSharedChannelProperties:
        bound_logger = log.bind(
            benefit_id=str(benefit.id), customer_id=str(customer.id)
        )

        invited_email = grant_properties.get("invited_email")
        if not invited_email:
            raise BenefitActionRequiredError(
                "Enter the email of an admin in your Slack workspace to "
                "receive the Slack Connect invite."
            )

        existing_channel_id = grant_properties.get("channel_id")
        if update and existing_channel_id and grant_properties.get("invite_id"):
            properties = self._get_properties(benefit)
            team_invitees = properties.get("team_invitees") or []
            if team_invitees:
                integration = await self._get_installed_integration(benefit)
                await self._safe_invite_team(
                    bot_token=cast(str, integration.bot_token),
                    channel=existing_channel_id,
                    users=team_invitees,
                    bound_logger=bound_logger,
                )
            return grant_properties

        if existing_channel_id:
            return await self._provision(
                benefit, customer, grant_properties, invited_email, bound_logger
            )

        locker = Locker(self.redis)
        try:
            async with locker.lock(
                f"slack_benefit_grant:{benefit.id}:{customer.id}",
                timeout=_PROVISIONING_LOCK_TTL_SECONDS,
                blocking_timeout=0,
            ):
                return await self._provision(
                    benefit, customer, grant_properties, invited_email, bound_logger
                )
        except TimeoutLockError as e:
            raise BenefitRetriableError(_PROVISIONING_LOCK_TTL_SECONDS) from e

    async def _provision(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantSlackSharedChannelProperties,
        invited_email: str,
        bound_logger: Any,
    ) -> BenefitGrantSlackSharedChannelProperties:
        properties = self._get_properties(benefit)
        integration = await self._get_installed_integration(benefit)

        context = self._build_context(customer)
        bot_token = cast(str, integration.bot_token)

        existing_channel_id = grant_properties.get("channel_id")
        if existing_channel_id:
            channel_id = existing_channel_id
            channel_name = grant_properties.get("channel_name", "")
        else:
            channel_id, channel_name = await self._find_channel_by_name(
                bot_token=bot_token,
                template=properties["channel_name_template"],
                context=context,
                is_private=properties["private"],
                bound_logger=bound_logger,
            ) or await self._create_channel(
                bot_token=bot_token,
                template=properties["channel_name_template"],
                context=context,
                is_private=properties["private"],
            )

            team_invitees = properties.get("team_invitees") or []
            if team_invitees:
                await self._safe_invite_team(
                    bot_token=bot_token,
                    channel=channel_id,
                    users=team_invitees,
                    bound_logger=bound_logger,
                )

            welcome_message = properties.get("welcome_message")
            if welcome_message:
                await self._safe_post_welcome(
                    bot_token=bot_token,
                    channel=channel_id,
                    text=welcome_message,
                    bound_logger=bound_logger,
                )

        provisioned_properties: BenefitGrantSlackSharedChannelProperties = {
            **grant_properties,
            "channel_id": channel_id,
            "channel_name": channel_name,
        }

        try:
            invite = await self._invite_shared(
                bot_token=bot_token, channel=channel_id, email=invited_email
            )
        except BenefitActionRequiredError as e:
            raise BenefitActionRequiredError(
                e.message, grant_properties=provisioned_properties
            ) from e

        completed_properties: BenefitGrantSlackSharedChannelProperties = {
            **provisioned_properties
        }
        invite_id = invite.get("invite_id")
        if isinstance(invite_id, str):
            completed_properties["invite_id"] = invite_id
        invite_url = invite.get("url")
        if isinstance(invite_url, str) and invite_url:
            completed_properties["invite_url"] = invite_url
        return completed_properties

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantSlackSharedChannelProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantSlackSharedChannelProperties:
        return grant_properties

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantSlackSharedChannelProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantSlackSharedChannelProperties:
        bound_logger = log.bind(
            benefit_id=str(benefit.id), customer_id=str(customer.id)
        )

        properties = self._get_properties(benefit)
        channel_id = grant_properties.get("channel_id")

        if not properties.get("archive_on_revoke") or not channel_id:
            return {"invited_email": grant_properties.get("invited_email", "")}

        integration = await self._get_integration(benefit)
        if integration is None or integration.bot_token is None:
            bound_logger.info("Slack integration uninstalled; skipping archive")
            return {"invited_email": grant_properties.get("invited_email", "")}

        try:
            result = await self._client.conversations_archive(
                bot_token=integration.bot_token, channel=channel_id
            )
        except httpx.HTTPError as e:
            bound_logger.warning("Slack archive failed", error=str(e))
            raise BenefitRetriableError() from e

        if not result.get("ok"):
            error = result.get("error", "")
            bound_logger.warning("Slack archive returned error", error=error)
            raise BenefitRetriableError()

        return {"invited_email": grant_properties.get("invited_email", "")}

    async def requires_update(
        self,
        benefit: Benefit,
        previous_properties: BenefitSlackSharedChannelProperties,
    ) -> bool:
        current = self._get_properties(benefit)
        return set(current.get("team_invitees") or []) != set(
            previous_properties.get("team_invitees") or []
        )

    async def validate_properties(
        self,
        auth_subject: AuthSubject[User | Organization],
        properties: dict[str, Any],
    ) -> BenefitSlackSharedChannelProperties:
        template = properties.get("channel_name_template", "")
        try:
            validate_template(template)
        except InvalidTemplateError as e:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "value_error",
                        "msg": str(e),
                        "loc": ("channel_name_template",),
                        "input": template,
                    }
                ]
            ) from e

        return cast(BenefitSlackSharedChannelProperties, properties)

    async def _get_installed_integration(self, benefit: Benefit) -> SlackApp:
        integration = await self._get_integration(benefit)
        if integration is None or integration.bot_token is None:
            raise BenefitActionRequiredError(
                "The Slack integration is not installed for this benefit."
            )
        return integration

    async def _get_integration(self, benefit: Benefit) -> SlackApp | None:
        integration_id = benefit.properties.get("slack_integration_id")
        if not isinstance(integration_id, str):
            return None
        try:
            slack_integration_id = UUID(integration_id)
        except ValueError:
            return None

        repository = SlackAppRepository.from_session(self.session)
        integration = await repository.get_by_id(slack_integration_id)
        if (
            integration is None
            or integration.organization_id != benefit.organization_id
        ):
            return None
        return integration

    def _build_context(self, customer: Customer) -> TemplateContext:
        email = customer.email or ""
        return TemplateContext(
            customer_name=customer.name or email or "customer",
            customer_email_local=email.split("@", 1)[0] if email else "customer",
            metadata=dict(customer.user_metadata or {}),
        )

    def _render_channel_name(
        self, template: str, context: TemplateContext, *, suffix: str | None = None
    ) -> str:
        try:
            return render_channel_name(template, context, suffix=suffix)
        except InvalidTemplateError as e:
            raise BenefitActionRequiredError(str(e)) from e

    async def _find_channel_by_name(
        self,
        *,
        bot_token: str,
        template: str,
        context: TemplateContext,
        is_private: bool,
        bound_logger: Any,
    ) -> tuple[str, str] | None:
        name = self._render_channel_name(template, context)
        types = ["private_channel"] if is_private else ["public_channel"]
        cursor: str | None = None

        while True:
            try:
                result = await self._client.conversations_list(
                    bot_token=bot_token, cursor=cursor, types=types
                )
            except httpx.HTTPError as e:
                raise BenefitRetriableError() from e

            if not result.get("ok"):
                error = result.get("error", "")
                if error == "missing_scope":
                    bound_logger.info("Slack channel lookup skipped", error=error)
                    return None
                raise BenefitActionRequiredError(f"Slack channel lookup error: {error}")

            for channel in result.get("channels") or []:
                channel_name = channel.get("name") or channel.get("name_normalized")
                if not isinstance(channel_name, str) or channel_name != name:
                    continue

                channel_id = channel.get("id")
                if not isinstance(channel_id, str):
                    continue

                if channel.get("is_private"):
                    if not channel.get("is_member"):
                        bound_logger.info(
                            "Slack private channel found but app is not a member",
                            channel_id=channel_id,
                        )
                        return None
                    return channel_id, channel_name

                if not channel.get("is_member"):
                    joined = await self._join_public_channel(
                        bot_token=bot_token,
                        channel=channel_id,
                        bound_logger=bound_logger,
                    )
                    if not joined:
                        return None

                return channel_id, channel_name

            cursor = (result.get("response_metadata") or {}).get("next_cursor")
            if not cursor:
                return None

    async def _join_public_channel(
        self,
        *,
        bot_token: str,
        channel: str,
        bound_logger: Any,
    ) -> bool:
        try:
            result = await self._client.conversations_join(
                bot_token=bot_token, channel=channel
            )
        except httpx.HTTPError as e:
            raise BenefitRetriableError() from e

        if result.get("ok"):
            return True

        bound_logger.info(
            "Slack public channel join skipped",
            channel_id=channel,
            error=result.get("error"),
        )
        return False

    async def _create_channel(
        self,
        *,
        bot_token: str,
        template: str,
        context: TemplateContext,
        is_private: bool,
    ) -> tuple[str, str]:
        name = self._render_channel_name(template, context)
        try:
            result = await self._client.conversations_create(
                bot_token=bot_token, name=name, is_private=is_private
            )
        except httpx.HTTPError as e:
            raise BenefitRetriableError() from e

        if result.get("ok"):
            channel = result.get("channel") or {}
            return channel["id"], channel.get("name", name)

        error = result.get("error", "")
        if error != "name_taken":
            raise BenefitActionRequiredError(f"Slack error: {error}")

        name = self._render_channel_name(template, context, suffix=secrets.token_hex(2))
        try:
            result = await self._client.conversations_create(
                bot_token=bot_token, name=name, is_private=is_private
            )
        except httpx.HTTPError as e:
            raise BenefitRetriableError() from e

        if result.get("ok"):
            channel = result.get("channel") or {}
            return channel["id"], channel.get("name", name)

        error = result.get("error", "")
        raise BenefitActionRequiredError(f"Slack error: {error}")

    async def _safe_invite_team(
        self,
        *,
        bot_token: str,
        channel: str,
        users: list[str],
        bound_logger: Any,
    ) -> None:
        try:
            result = await self._client.conversations_invite(
                bot_token=bot_token, channel=channel, users=users
            )
        except httpx.HTTPError as e:
            bound_logger.warning("Slack team invite failed", error=str(e))
            return
        if not result.get("ok"):
            bound_logger.warning(
                "Slack team invite returned error", error=result.get("error")
            )

    async def _safe_post_welcome(
        self,
        *,
        bot_token: str,
        channel: str,
        text: str,
        bound_logger: Any,
    ) -> None:
        try:
            await self._client.chat_post_message(
                bot_token=bot_token, channel=channel, text=text
            )
        except httpx.HTTPError as e:
            bound_logger.warning("Slack welcome post failed", error=str(e))

    async def _invite_shared(
        self,
        *,
        bot_token: str,
        channel: str,
        email: str,
    ) -> dict[str, Any]:
        try:
            result = await self._client.conversations_invite_shared(
                bot_token=bot_token, channel=channel, email=email
            )
        except httpx.HTTPError as e:
            raise BenefitRetriableError() from e

        if not result.get("ok"):
            error = result.get("error", "")
            raise BenefitActionRequiredError(f"Slack invite error: {error}")

        return result
