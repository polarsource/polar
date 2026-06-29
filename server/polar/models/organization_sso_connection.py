from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, TypeAdapter, model_validator
from sqlalchemy import Boolean, ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .organization import Organization


class OrganizationSSOConnectionType(StrEnum):
    oidc = "oidc"


class OIDCAuthMethod(StrEnum):
    client_secret = "client_secret"
    private_key_jwt = "private_key_jwt"


class OIDCConfiguration(BaseModel):
    type: Literal[OrganizationSSOConnectionType.oidc] = (
        OrganizationSSOConnectionType.oidc
    )
    issuer: str
    client_id: str
    auth_method: OIDCAuthMethod
    client_secret: str | None = None

    @model_validator(mode="after")
    def validate_auth_method(self) -> Self:
        if self.auth_method == OIDCAuthMethod.client_secret and not self.client_secret:
            raise ValueError("client_secret is required for client_secret auth method")
        if self.auth_method == OIDCAuthMethod.private_key_jwt and self.client_secret:
            raise ValueError("client_secret must not be set for private_key_jwt")
        return self


Configuration = OIDCConfiguration
ConfigurationTypeAdapter: TypeAdapter[Configuration] = TypeAdapter(Configuration)


class ConfigurationType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, BaseModel):
            return value.model_dump()
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is not None:
            return ConfigurationTypeAdapter.validate_python(value)
        return value


class OrganizationSSOConnection(RecordModel):
    __tablename__ = "organization_sso_connections"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    type: Mapped[OrganizationSSOConnectionType] = mapped_column(
        StringEnum(OrganizationSSOConnectionType), nullable=False
    )
    configuration: Mapped[Configuration] = mapped_column(
        ConfigurationType, nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
