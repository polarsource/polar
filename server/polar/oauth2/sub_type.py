from enum import StrEnum
from typing import TYPE_CHECKING, Literal, TypeGuard
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import Organization, User


class SubType(StrEnum):
    user = "user"
    organization = "organization"


SubTypeValue = tuple[SubType, "User | Organization"]


def is_sub_user(v: SubTypeValue) -> TypeGuard[tuple[Literal[SubType.user], "User"]]:
    return v[0] == SubType.user


def is_sub_organization(
    v: SubTypeValue,
) -> TypeGuard[tuple[Literal[SubType.organization], "Organization"]]:
    return v[0] == SubType.organization


class SubTypeModelMixin:
    sub_type: Mapped[SubType] = mapped_column(String, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("users.id", ondelete="cascade"), nullable=True
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id", ondelete="cascade"), nullable=True
    )

    @declared_attr
    def user(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="joined")

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="joined")

    @hybrid_property
    def sub(self) -> "User | Organization":
        sub: "User | Organization | None" = None
        if self.sub_type == SubType.user:
            sub = self.user
        elif self.sub_type == SubType.organization:
            sub = self.organization
        else:
            raise NotImplementedError()

        if sub is None:
            raise ValueError("Sub is not found.")

        return sub

    @sub.inplace.setter
    def _sub_setter(self, value: "User | Organization") -> None:
        if self.sub_type == SubType.user:
            self.user = value
        elif self.sub_type == SubType.organization:
            self.organization = value
        else:
            raise NotImplementedError()

    def get_sub_type_value(self) -> SubTypeValue:
        return self.sub_type, self.sub
