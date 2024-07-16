from datetime import datetime
from typing import Self
from uuid import UUID

from polar.enums import Platforms
from polar.integrations.github import types
from polar.kit.schemas import Schema


# Public API
class ExternalOrganization(Schema):
    id: UUID
    platform: Platforms
    name: str
    avatar_url: str
    is_personal: bool

    bio: str | None = None
    pretty_name: str | None = None
    company: str | None = None
    blog: str | None = None
    location: str | None = None
    email: str | None = None
    twitter_username: str | None = None


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
