from typing import Any, Literal
from urllib.parse import urlencode
from uuid import UUID

import structlog

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.config import settings
from polar.exceptions import BadRequest, PolarError, ResourceNotFound
from polar.kit import jwt
from polar.kit.db.postgres import AsyncReadSession, AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationSlackIntegration

from .client import SlackClient
from .manifest import BOT_SCOPES
from .repository import OrganizationSlackIntegrationRepository
from .schemas import SlackIntegrationCredentialsUpdate

log = structlog.get_logger()

OAUTH_STATE_JWT_TYPE: Literal["slack_integration_oauth"] = "slack_integration_oauth"
CALLBACK_ROUTE = "integrations.slack.callback"


class SlackIntegrationError(PolarError): ...


class SlackIntegrationInvalidCredentials(BadRequest):
    def __init__(self, error: str) -> None:
        self.slack_error = error
        super().__init__(f"Slack rejected the credentials: {error}")


class SlackIntegrationNotConfigured(ResourceNotFound):
    def __init__(self) -> None:
        super().__init__("Slack integration is not configured for this organization.")


class SlackIntegrationInvalidState(BadRequest):
    def __init__(self, reason: str) -> None:
        super().__init__(f"Invalid OAuth state: {reason}")


class SlackIntegrationAppIdAlreadyLinked(BadRequest):
    def __init__(self) -> None:
        super().__init__(
            "This Slack app is already linked to another Polar organization."
        )


# Errors that mean credentials parsed but code was rejected — credentials are OK.
_VALID_CREDENTIALS_ERRORS = {"invalid_code", "bad_redirect_uri"}


class OrganizationSlackIntegrationService:
    def __init__(self) -> None:
        self._client = SlackClient()

    async def get(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> OrganizationSlackIntegration | None:
        repository = OrganizationSlackIntegrationRepository.from_session(session)
        return await repository.get_by_organization(organization_id)

    async def set_credentials(
        self,
        session: AsyncSession,
        organization: Organization,
        update: SlackIntegrationCredentialsUpdate,
        *,
        redirect_uri: str,
    ) -> OrganizationSlackIntegration:
        repository = OrganizationSlackIntegrationRepository.from_session(session)
        existing = await repository.get_by_organization(organization.id)

        # First time pasting credentials (no existing row, or only display_name
        # was persisted) requires both secrets.
        has_existing_credentials = (
            existing is not None
            and existing.client_secret is not None
            and existing.signing_secret is not None
        )
        if update.client_secret is None and not has_existing_credentials:
            raise SlackIntegrationInvalidCredentials("missing_client_secret")
        if update.signing_secret is None and not has_existing_credentials:
            raise SlackIntegrationInvalidCredentials("missing_signing_secret")

        client_secret = (
            update.client_secret or (existing.client_secret if existing else None) or ""
        )
        signing_secret = (
            update.signing_secret
            or (existing.signing_secret if existing else None)
            or ""
        )

        # Only round-trip to Slack when the credentials actually changed,
        # since the validation call costs a request and shouldn't run on
        # signing-secret-only rotations.
        if (
            existing is None
            or update.client_id != existing.client_id
            or client_secret != existing.client_secret
        ):
            await self._validate_credentials(
                client_id=update.client_id,
                client_secret=client_secret,
                redirect_uri=redirect_uri,
            )

        conflicting = await repository.get_by_app_id(update.slack_app_id)
        if conflicting is not None and conflicting.organization_id != organization.id:
            raise SlackIntegrationAppIdAlreadyLinked()

        if existing is None:
            integration = OrganizationSlackIntegration(
                organization_id=organization.id,
                display_name=update.display_name,
                slack_app_id=update.slack_app_id,
                client_id=update.client_id,
                client_secret=client_secret,
                signing_secret=signing_secret,
            )
            return await repository.create(integration, flush=True)

        # Existing stub row (display_name only): treat as a fresh install rather
        # than a credential rotation. Don't reset OAuth state on the first
        # credential write since there was nothing to reset.
        was_stub = existing.client_id is None

        update_dict: dict[str, Any] = {
            "display_name": update.display_name,
            "slack_app_id": update.slack_app_id,
            "client_id": update.client_id,
            "client_secret": client_secret,
            "signing_secret": signing_secret,
        }
        # client_id and slack_app_id identify which Slack app the OAuth flow
        # targets. If they change the app changes too, so the bot_token from
        # the previous install is no longer valid and we must reset OAuth
        # state. Rotating just the secrets keeps the install intact.
        if not was_stub and (
            update.client_id != existing.client_id
            or update.slack_app_id != existing.slack_app_id
        ):
            update_dict.update(
                {
                    "team_id": None,
                    "team_name": None,
                    "bot_user_id": None,
                    "bot_token": None,
                    "authed_user_id": None,
                    "scopes": None,
                    "installed_at": None,
                    "revoked_at": None,
                }
            )
        return await repository.update(existing, update_dict=update_dict)

    def build_authorize_url(
        self,
        integration: OrganizationSlackIntegration,
        *,
        subject_id: UUID,
        redirect_uri: str,
        return_to: str,
    ) -> str:
        state = jwt.encode(
            data={
                "organization_id": str(integration.organization_id),
                "subject_id": str(subject_id),
                "return_to": return_to,
            },
            secret=settings.SECRET,
            type=OAUTH_STATE_JWT_TYPE,
        )
        params = {
            "client_id": integration.client_id,
            "scope": ",".join(BOT_SCOPES),
            "redirect_uri": redirect_uri,
            "state": state,
        }
        return f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"

    def decode_state(self, state: str) -> dict[str, Any]:
        try:
            return jwt.decode(
                token=state,
                secret=settings.SECRET,
                type=OAUTH_STATE_JWT_TYPE,
            )
        except (jwt.DecodeError, jwt.ExpiredSignatureError) as e:
            raise SlackIntegrationInvalidState(str(e)) from e

    async def delete(
        self,
        session: AsyncSession,
        integration: OrganizationSlackIntegration,
    ) -> None:
        await session.delete(integration)
        await session.flush()

    async def upsert_display_name(
        self,
        session: AsyncSession,
        organization: Organization,
        display_name: str,
    ) -> OrganizationSlackIntegration:
        repository = OrganizationSlackIntegrationRepository.from_session(session)
        existing = await repository.get_by_organization(organization.id)
        if existing is None:
            integration = OrganizationSlackIntegration(
                organization_id=organization.id, display_name=display_name
            )
            return await repository.create(integration, flush=True)
        if existing.display_name == display_name:
            return existing
        return await repository.update(
            existing, update_dict={"display_name": display_name}
        )

    async def list_workspace_users(
        self,
        integration: OrganizationSlackIntegration,
    ) -> list[dict[str, Any]]:
        if integration.bot_token is None:
            return []

        users: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            result = await self._client.users_list(
                bot_token=integration.bot_token, cursor=cursor
            )
            if not result.get("ok"):
                break
            for member in result.get("members") or []:
                if member.get("deleted") or member.get("is_bot"):
                    continue
                if member.get("id") == "USLACKBOT":
                    continue
                profile = member.get("profile") or {}
                users.append(
                    {
                        "id": member["id"],
                        "name": member.get("name") or "",
                        "real_name": profile.get("real_name")
                        or member.get("real_name"),
                        "image_url": profile.get("image_72"),
                        "is_admin": bool(member.get("is_admin")),
                    }
                )
            cursor = (result.get("response_metadata") or {}).get("next_cursor")
            if not cursor:
                break
        users.sort(key=lambda u: (u["real_name"] or u["name"]).lower())
        return users

    async def complete_install(
        self,
        session: AsyncSession,
        organization_id: UUID,
        *,
        code: str,
        redirect_uri: str,
    ) -> OrganizationSlackIntegration:
        repository = OrganizationSlackIntegrationRepository.from_session(session)
        integration = await repository.get_by_organization(organization_id)
        if (
            integration is None
            or integration.client_id is None
            or integration.client_secret is None
        ):
            raise SlackIntegrationNotConfigured()

        result = await self._client.oauth_v2_access(
            client_id=integration.client_id,
            client_secret=integration.client_secret,
            code=code,
            redirect_uri=redirect_uri,
        )
        if not result.get("ok"):
            raise SlackIntegrationInvalidCredentials(
                result.get("error", "unknown_error")
            )

        # Slack returns the actual app_id that the client_id/secret authenticated;
        # reject if it doesn't match the slack_app_id submitted at credentials time,
        # otherwise an org could squat on another org's slack_app_id.
        installed_app_id = result.get("app_id")
        if installed_app_id and installed_app_id != integration.slack_app_id:
            raise SlackIntegrationInvalidCredentials("app_id_mismatch")

        team = result.get("team") or {}
        return await repository.update(
            integration,
            update_dict={
                "team_id": team.get("id"),
                "team_name": team.get("name"),
                "bot_user_id": result.get("bot_user_id"),
                "bot_token": result.get("access_token"),
                "authed_user_id": (result.get("authed_user") or {}).get("id"),
                "scopes": result["scope"].split(",") if result.get("scope") else None,
                "installed_at": utc_now(),
                "revoked_at": None,
            },
        )

    async def handle_event(
        self,
        session: AsyncSession,
        *,
        api_app_id: str,
        event: dict[str, Any],
    ) -> None:
        event_type = event.get("type", "")
        repository = OrganizationSlackIntegrationRepository.from_session(session)
        integration = await repository.get_by_app_id(api_app_id)
        if integration is None:
            log.info(
                "slack.events.unknown_app",
                api_app_id=api_app_id,
                event_type=event_type,
            )
            return

        if event_type in ("tokens_revoked", "app_uninstalled"):
            await repository.update(
                integration,
                update_dict={
                    "bot_token": None,
                    "revoked_at": utc_now(),
                },
            )
            log.info(
                "slack.events.integration_revoked",
                organization_id=str(integration.organization_id),
                api_app_id=api_app_id,
                event_type=event_type,
            )
            return

        if event_type == "channel_shared":
            await self._handle_channel_shared(
                session, integration=integration, event=event
            )
            return

        log.debug(
            "slack.events.unhandled",
            api_app_id=api_app_id,
            event_type=event_type,
        )

    async def _handle_channel_shared(
        self,
        session: AsyncSession,
        *,
        integration: OrganizationSlackIntegration,
        event: dict[str, Any],
    ) -> None:
        channel_id = event.get("channel")
        connected_team_id = event.get("connected_team_id")
        if not channel_id:
            return

        repository = BenefitGrantRepository.from_session(session)
        grant = await repository.get_by_property_and_organization(
            integration.organization_id,
            "slack_shared_channel",
            "channel_id",
            channel_id,
            for_update=True,
        )
        if grant is None:
            return

        properties = dict(grant.properties or {})
        if connected_team_id:
            properties["connected_team_id"] = connected_team_id
        await repository.update(grant, update_dict={"properties": properties})

    async def _validate_credentials(
        self,
        *,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
    ) -> None:
        result = await self._client.oauth_v2_access(
            client_id=client_id,
            client_secret=client_secret,
            code="validation",
            redirect_uri=redirect_uri,
        )
        if result.get("ok"):
            return
        error = result.get("error", "unknown_error")
        if error in _VALID_CREDENTIALS_ERRORS:
            return
        raise SlackIntegrationInvalidCredentials(error)


organization_slack_integration = OrganizationSlackIntegrationService()
