from enum import StrEnum
from typing import TYPE_CHECKING, Literal, TypeGuard
from uuid import UUID

from pydantic import GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema as cs
from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

if TYPE_CHECKING:
    from polar.models import Agent, Organization, User


class SubType(StrEnum):
    user = "user"
    organization = "organization"
    agent = "agent"

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: cs.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        # The OAuth2 API never exposes the agent sub type: introspection needs a
        # client secret, which agent clients don't have, and a client's
        # `default_sub_type` is never persisted (authlib only keeps registered
        # claims). Keep it out of the API contract.
        json_schema = handler(core_schema)
        json_schema = handler.resolve_ref_schema(json_schema)
        json_schema["enum"] = [SubType.user, SubType.organization]
        return json_schema


SubTypeValue = tuple[SubType, "User | Organization | Agent"]


def is_sub_user(v: SubTypeValue) -> TypeGuard[tuple[Literal[SubType.user], "User"]]:
    return v[0] == SubType.user


def is_sub_organization(
    v: SubTypeValue,
) -> TypeGuard[tuple[Literal[SubType.organization], "Organization"]]:
    return v[0] == SubType.organization


def is_sub_agent(
    v: SubTypeValue,
) -> TypeGuard[tuple[Literal[SubType.agent], "Agent"]]:
    return v[0] == SubType.agent


class SubTypeModelMixin:
    sub_type: Mapped[SubType] = mapped_column(String, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=True
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=True
    )
    agent_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("agents.id", ondelete="cascade"), nullable=True, index=True
    )

    @declared_attr
    def user(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="joined")

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="joined")

    @declared_attr
    def agent(cls) -> Mapped["Agent | None"]:
        return relationship("Agent", lazy="joined")

    @hybrid_property
    def sub(self) -> "User | Organization | Agent":
        sub: User | Organization | Agent | None = None
        if self.sub_type == SubType.user:
            sub = self.user
        elif self.sub_type == SubType.organization:
            sub = self.organization
        elif self.sub_type == SubType.agent:
            sub = self.agent
        else:
            raise NotImplementedError()

        if sub is None:
            raise ValueError("Sub is not found.")

        return sub

    @sub.inplace.setter
    def _sub_setter(self, value: "User | Organization | Agent") -> None:
        if self.sub_type == SubType.user:
            self.user_id = value.id
        elif self.sub_type == SubType.organization:
            self.organization_id = value.id
        elif self.sub_type == SubType.agent:
            self.agent_id = value.id
        else:
            raise NotImplementedError()

    def get_sub_type_value(self) -> SubTypeValue:
        return self.sub_type, self.sub
