from datetime import datetime
from typing import Annotated

from pydantic import UUID4, Field, StringConstraints

from polar.kit.schemas import Schema, TimestampedSchema

# Slack app IDs look like A0XXXXXXXXX (11 chars). Client IDs are numeric.dot.numeric.
# Signing secrets and client secrets are 32-char hex blobs in practice but Slack
# does not document a fixed length — keep these loose and let the API tell us.
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
        min_length=4,
        max_length=128,
        pattern=r"^[0-9.]+$",
        strip_whitespace=True,
    ),
]
SlackSecret = Annotated[
    str, StringConstraints(min_length=8, max_length=128, strip_whitespace=True)
]
DisplayName = Annotated[str, StringConstraints(min_length=1, max_length=35)]


class SlackIntegrationCredentialsUpdate(Schema):
    organization_id: UUID4 | None = Field(
        default=None,
        description=(
            "Target organization. Required when authenticated as a user. Must be "
            "omitted when authenticated with an organization token."
        ),
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
    organization_id: UUID4 | None = Field(default=None)
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
    real_name: str | None = Field(
        default=None, description="Display name, if set."
    )
    image_url: str | None = Field(
        default=None, description="Avatar URL (image_72), if available."
    )
    is_admin: bool = Field(
        default=False, description="Whether the user is a workspace admin."
    )


class SlackWorkspaceUsersResponse(Schema):
    users: list[SlackWorkspaceUser]


class SlackIntegration(TimestampedSchema):
    id: UUID4
    organization_id: UUID4

    display_name: str
    slack_app_id: str
    client_id: str
    client_id_last_4: str = Field(
        description="Last four characters of the Client ID (display only)."
    )
    client_secret_last_4: str
    signing_secret_last_4: str

    team_id: str | None
    team_name: str | None
    bot_user_id: str | None
    authed_user_id: str | None
    scopes: list[str] | None
    installed_at: datetime | None
    revoked_at: datetime | None
