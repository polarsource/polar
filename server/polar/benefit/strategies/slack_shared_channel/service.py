import secrets
from typing import Any, cast
from uuid import UUID

import httpx
import structlog

from polar.auth.models import AuthSubject
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.integrations.slack.client import SlackClient
from polar.integrations.slack.repository import SlackAppRepository
from polar.locker import Locker, TimeoutLockError
from polar.logging import Logger
from polar.models import (
    Benefit,
    Customer,
    Member,
    Organization,
    SlackApp,
    Subscription,
    User,
)

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
)

log: Logger = structlog.get_logger()

_PROVISIONING_LOCK_TTL_SECONDS = 60

_ARCHIVE_NOOP_ERRORS = {"already_archived", "channel_not_found"}
_ARCHIVE_TRANSIENT_ERRORS = {
    "ratelimited",
    "internal_error",
    "fatal_error",
    "service_unavailable",
}


class BenefitSlackSharedChannelService(
    BenefitServiceProtocol[
        BenefitSlackSharedChannelProperties,
        BenefitGrantSlackSharedChannelProperties,
    ]
):
    _client = SlackClient()

    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantSlackSharedChannelProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
        subscription: Subscription | None = None,
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
            await self._unarchive_channel(
                bot_token=bot_token,
                channel=channel_id,
                bound_logger=bound_logger,
            )
        elif sibling_channel := await self._find_sibling_channel(benefit, customer):
            channel_id, channel_name = sibling_channel
        else:
            channel_id, channel_name, created = await self._create_channel(
                bot_token=bot_token,
                template=properties["channel_name_template"],
                context=context,
                is_private=properties["private"],
                bound_logger=bound_logger,
            )

            if created:
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
            return self._revoked_properties(grant_properties, keep_channel=True)

        grant_repository = BenefitGrantRepository.from_session(self.session)
        total_grants = (
            await grant_repository.count_granted_by_property_and_organization(
                benefit.organization_id, "channel_id", channel_id
            )
        )
        own_grants = await grant_repository.list_granted_by_benefit_and_customer(
            benefit, customer
        )
        own_count = sum(
            1
            for grant in own_grants
            if grant.properties.get("channel_id") == channel_id
        )
        if total_grants - own_count > 0:
            bound_logger.info(
                "Slack channel still used by other grants; skipping archive",
                channel_id=channel_id,
            )
            return self._revoked_properties(grant_properties, keep_channel=True)

        integration = await self._get_integration(benefit)
        if integration is None or integration.bot_token is None:
            bound_logger.info("Slack integration uninstalled; skipping archive")
            return self._revoked_properties(grant_properties, keep_channel=True)

        try:
            result = await self._client.conversations_archive(
                bot_token=integration.bot_token, channel=channel_id
            )
        except httpx.HTTPError as e:
            bound_logger.warning("Slack archive failed", error=str(e))
            raise BenefitRetriableError() from e

        if not result.get("ok"):
            error = result.get("error", "")
            if error in _ARCHIVE_NOOP_ERRORS:
                bound_logger.info("Slack channel already archived or gone", error=error)
                return self._revoked_properties(
                    grant_properties, keep_channel=error != "channel_not_found"
                )
            bound_logger.warning("Slack archive returned error", error=error)
            if error in _ARCHIVE_TRANSIENT_ERRORS:
                raise BenefitRetriableError()
            raise BenefitActionRequiredError(f"Slack archive error: {error}")

        return self._revoked_properties(grant_properties, keep_channel=True)

    def _revoked_properties(
        self,
        grant_properties: BenefitGrantSlackSharedChannelProperties,
        *,
        keep_channel: bool,
    ) -> BenefitGrantSlackSharedChannelProperties:
        revoked: BenefitGrantSlackSharedChannelProperties = {
            "invited_email": grant_properties.get("invited_email", "")
        }
        if keep_channel:
            channel_id = grant_properties.get("channel_id")
            if channel_id:
                revoked["channel_id"] = channel_id
                channel_name = grant_properties.get("channel_name")
                if channel_name:
                    revoked["channel_name"] = channel_name
        return revoked

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
        organization: Organization,
        properties: dict[str, Any],
    ) -> BenefitSlackSharedChannelProperties:
        integration_id = properties["slack_integration_id"]
        repository = SlackAppRepository.from_session(self.session)
        integration = await repository.get_by_id(UUID(integration_id))
        if integration is None or integration.organization_id != organization.id:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "value_error",
                        "msg": "Slack integration not found.",
                        "loc": ("slack_integration_id",),
                        "input": integration_id,
                    }
                ]
            )
        if integration.bot_token is None:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "value_error",
                        "msg": "The Slack integration is not installed.",
                        "loc": ("slack_integration_id",),
                        "input": integration_id,
                    }
                ]
            )
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

    async def _find_sibling_channel(
        self, benefit: Benefit, customer: Customer
    ) -> tuple[str, str] | None:
        repository = BenefitGrantRepository.from_session(self.session)
        grants = await repository.list_granted_by_benefit_and_customer(
            benefit, customer
        )
        for grant in grants:
            channel_id = grant.properties.get("channel_id")
            if isinstance(channel_id, str) and channel_id:
                channel_name = grant.properties.get("channel_name")
                return channel_id, channel_name if isinstance(channel_name, str) else ""
        return None

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
                    bot_token=bot_token,
                    cursor=cursor,
                    types=types,
                    exclude_archived=False,
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

                if channel.get("is_archived"):
                    unarchived = await self._unarchive_channel(
                        bot_token=bot_token,
                        channel=channel_id,
                        bound_logger=bound_logger,
                    )
                    if not unarchived:
                        return None

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

    async def _unarchive_channel(
        self,
        *,
        bot_token: str,
        channel: str,
        bound_logger: Any,
    ) -> bool:
        try:
            result = await self._client.conversations_unarchive(
                bot_token=bot_token, channel=channel
            )
        except httpx.HTTPError as e:
            raise BenefitRetriableError() from e

        if result.get("ok") or result.get("error") == "not_archived":
            return True

        bound_logger.info(
            "Slack channel unarchive skipped",
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
        bound_logger: Any,
    ) -> tuple[str, str, bool]:
        name = self._render_channel_name(template, context)
        result = await self._create_channel_once(
            bot_token=bot_token, name=name, is_private=is_private
        )
        if result.get("ok"):
            channel = result.get("channel") or {}
            return channel["id"], channel.get("name", name), True

        error = result.get("error", "")
        if error != "name_taken":
            raise BenefitActionRequiredError(f"Slack error: {error}")

        existing = await self._find_channel_by_name(
            bot_token=bot_token,
            template=template,
            context=context,
            is_private=is_private,
            bound_logger=bound_logger,
        )
        if existing:
            channel_id, channel_name = existing
            return channel_id, channel_name, False

        name = self._render_channel_name(template, context, suffix=secrets.token_hex(2))
        result = await self._create_channel_once(
            bot_token=bot_token, name=name, is_private=is_private
        )
        if result.get("ok"):
            channel = result.get("channel") or {}
            return channel["id"], channel.get("name", name), True

        error = result.get("error", "")
        raise BenefitActionRequiredError(f"Slack error: {error}")

    async def _create_channel_once(
        self, *, bot_token: str, name: str, is_private: bool
    ) -> dict[str, Any]:
        try:
            return await self._client.conversations_create(
                bot_token=bot_token, name=name, is_private=is_private
            )
        except httpx.HTTPError as e:
            raise BenefitRetriableError() from e

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
