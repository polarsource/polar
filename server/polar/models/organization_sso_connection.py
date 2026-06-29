from enum import StrEnum
from typing import TYPE_CHECKING, NotRequired, TypedDict
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .organization import Organization


class OrganizationSSOConnectionType(StrEnum):
    oidc = "oidc"


class OIDCAuthMethod(StrEnum):
    client_secret = "client_secret"
    private_key_jwt = "private_key_jwt"


class OIDCConfiguration(TypedDict):
    issuer: str
    client_id: str
    auth_method: OIDCAuthMethod
    client_secret: NotRequired[str]


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
    configuration: Mapped[OIDCConfiguration] = mapped_column(JSONB, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
