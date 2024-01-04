from typing import Self

from polar.kit.schemas import Schema
from polar.models.user_organization import UserOrganization as UserOrganizationModel


class OrganizationMember(Schema):
    name: str
    github_username: str | None = None
    avatar_url: str | None = None
    is_admin: bool

    @classmethod
    def from_db(cls, o: UserOrganizationModel) -> Self:
        return cls(
            name=o.user.username,
            github_username=o.user.username,
            avatar_url=o.user.avatar_url,
            is_admin=o.is_admin,
        )
