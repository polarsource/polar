from datetime import datetime
from typing import Annotated

from pydantic import (
    UUID4,
    AfterValidator,
    AliasPath,
    BeforeValidator,
    Field,
    StringConstraints,
    field_validator,
)

from polar.kit.schemas import Schema, TimestampedSchema

# Slack app IDs look like A0XXXXXXXXX (11 chars). Client IDs are numeric.dot.numeric.
# Signing secrets and client secrets are 32-char hex blobs in practice but Slack
# does not document a fixed length; keep these loose and let the API tell us.
# strip_whitespace catches the common trailing-newline copy/paste mistake before
# the value reaches signature verification.
SlackAppId = Annotated[
    str,
    StringConstraints(
        min_length=11,
        max_length=32,
        pattern=r"^A[A-Z0-9]+$",
        strip_whitespace=True,
    ),
]
SlackClientId = Annotated[
    str,
    StringConstraints(
        min_length=3,
        max_length=128,
        pattern=r"^[0-9]+\.[0-9]+$",
        strip_whitespace=True,
    ),
]
SlackSecret = Annotated[
    str, StringConstraints(min_length=8, max_length=128, strip_whitespace=True)
]
DisplayName = Annotated[str, StringConstraints(min_length=1, max_length=35)]


def _empty_if_none(value: str | None) -> str:
    return value or ""


def _last_4(value: str | None) -> str:
    return value[-4:] if value else ""


SecretLast4 = Annotated[str, BeforeValidator(_empty_if_none), AfterValidator(_last_4)]


class SlackIntegrationCredentialsUpdate(Schema):
    organization_id: UUID4 = Field(
        description="Organization the integration belongs to."
    )
    display_name: DisplayName = Field(
        description=(
            "Display name used by the bot user in your Slack workspace. "
            "Reflected in the manifest."
        )
    )
    slack_app_id: SlackAppId = Field(
        description="App ID from your Slack app's Basic Information page."
    )
    client_id: SlackClientId = Field(
        description="Client ID from your Slack app's Basic Information page."
    )
    client_secret: SlackSecret | None = Field(
        default=None,
        description=(
            "Client Secret from your Slack app's Basic Information page. "
            "Omit to keep the existing value when updating other fields."
        ),
    )
    signing_secret: SlackSecret | None = Field(
        default=None,
        description=(
            "Signing Secret from your Slack app's Basic Information page. "
            "Omit to keep the existing value when updating other fields."
        ),
    )


class SlackIntegrationManifestRequest(Schema):
    display_name: DisplayName = Field(
        description=(
            "Name shown in your Slack workspace for the app and bot user. "
            "Defaults to your organization name; customize before pasting into Slack."
        )
    )


class SlackIntegrationManifest(Schema):
    manifest: str = Field(description="YAML manifest to paste into Slack.")


class SlackWorkspaceUser(Schema):
    id: str = Field(description="Slack user ID (e.g. U01234567).")
    name: str = Field(description="Username (handle without @).")
    real_name: str | None = Field(default=None, description="Display name, if set.")
    image_url: str | None = Field(
        default=None, description="Avatar URL (image_72), if available."
    )
    is_admin: bool = Field(
        default=False, description="Whether the user is a workspace admin."
    )


class SlackWorkspaceUsersResponse(Schema):
    users: list[SlackWorkspaceUser] = Field(
        description="Active, non-bot users in the connected Slack workspace."
    )


class SlackIntegration(TimestampedSchema):
    id: UUID4 = Field(description="ID of the Slack integration.")
    organization_id: UUID4 = Field(
        description="Organization that owns the Slack integration."
    )

    display_name: str = Field(description="Display name used by the Slack app.")
    slack_app_id: str = Field(description="Slack app ID.")
    client_id: str = Field(description="Slack client ID.")
    client_id_last_4: SecretLast4 = Field(
        validation_alias=AliasPath("client_id"),
        description="Last four characters of the Client ID (display only).",
    )
    client_secret_last_4: SecretLast4 = Field(
        validation_alias=AliasPath("client_secret"),
        description="Last four characters of the client secret (display only).",
    )
    signing_secret_last_4: SecretLast4 = Field(
        validation_alias=AliasPath("signing_secret"),
        description="Last four characters of the signing secret (display only).",
    )

    team_id: str | None = Field(description="Slack workspace ID, if installed.")
    team_name: str | None = Field(description="Slack workspace name, if installed.")
    bot_user_id: str | None = Field(description="Installed bot user ID, if any.")
    authed_user_id: str | None = Field(
        description="Slack user ID that authorized the app, if installed."
    )
    scopes: list[str] | None = Field(description="Granted Slack bot scopes, if any.")
    installed_at: datetime | None = Field(
        description="Timestamp when the Slack app was installed."
    )
    revoked_at: datetime | None = Field(
        description="Timestamp when the Slack app was revoked or uninstalled."
    )

    @field_validator("slack_app_id", "client_id", mode="before")
    @classmethod
    def empty_if_none(cls, value: str | None) -> str:
        return _empty_if_none(value)


class SlackIntegrationsResponse(Schema):
    integrations: list[SlackIntegration] = Field(
        description="Slack apps configured for the organization."
    )
