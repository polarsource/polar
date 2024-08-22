from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import UUID4

from polar.enums import Platforms
from polar.integrations.github import types
from polar.kit.schemas import MergeJSONSchema, Schema, SelectorWidget
from polar.organization.schemas import OrganizationID

ExternalOrganizationID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The external organization ID."}),
    SelectorWidget("/v1/external-organizations", "External Organization", "name"),
]


# Public API
class ExternalOrganization(Schema):
    id: UUID
    platform: Platforms
    name: str
    avatar_url: str
    is_personal: bool

    bio: str | None
    pretty_name: str | None
    company: str | None
    blog: str | None
    location: str | None
    email: str | None
    twitter_username: str | None

    organization_id: OrganizationID | None


#
# Internal models below. Not to be used in "public" APIs!
#


# Internal model
class ExternalOrganizationCreateFromGitHubInstallation(Schema):
    platform: Platforms
    name: str
    avatar_url: str
    external_id: int
    is_personal: bool
    installation_id: int
    installation_created_at: datetime
    installation_updated_at: datetime
    installation_suspended_at: datetime | None = None
    installation_permissions: types.AppPermissionsType

    @classmethod
    def from_github(
        cls,
        *,
        user: types.SimpleUser,
        installation: types.Installation,
    ) -> Self:
        return cls(
            platform=Platforms.github,
            name=user.login,
            external_id=user.id,
            avatar_url=user.avatar_url,
            is_personal=user.type.lower() == "user",
            installation_id=installation.id,
            installation_created_at=installation.created_at,
            installation_updated_at=installation.updated_at,
            installation_suspended_at=installation.suspended_at,
            installation_permissions=types.app_permissions_from_github(
                installation.permissions
            ),
        )


# Internal model
class ExternalOrganizationCreateFromGitHubUser(Schema):
    platform: Platforms
    name: str
    avatar_url: str
    external_id: int
    is_personal: bool

    @classmethod
    def from_github(
        cls,
        *,
        user: types.SimpleUser,
    ) -> Self:
        return cls(
            platform=Platforms.github,
            name=user.login,
            external_id=user.id,
            avatar_url=user.avatar_url,
            is_personal=user.type.lower() == "user",
        )
