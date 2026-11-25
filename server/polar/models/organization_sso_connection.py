from enum import StrEnum
from typing import TYPE_CHECKING, TypedDict
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.encryption import EncryptedString, EncryptedStringType
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .organization import Organization


ORGANIZATION_SSO_CONNECTION_CLIENT_SECRET_CONTEXT = {
    "table": "organization_sso_connections",
    "column": "client_secret",
}


class OrganizationSSOConnectionType(StrEnum):
    oidc = "oidc"


class OIDCAuthMethod(StrEnum):
    client_secret = "client_secret"
    private_key_jwt = "private_key_jwt"


class OIDCConfiguration(TypedDict):
    issuer: str
    client_id: str
    auth_method: OIDCAuthMethod
    authorization_parameters: dict[str, str]


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

    name: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[OrganizationSSOConnectionType] = mapped_column(
        StringEnum(OrganizationSSOConnectionType), nullable=False
    )
    configuration: Mapped[OIDCConfiguration] = mapped_column(JSONB, nullable=False)
    client_secret_encrypted: Mapped[EncryptedString | None] = mapped_column(
        EncryptedStringType(ORGANIZATION_SSO_CONNECTION_CLIENT_SECRET_CONTEXT),
        nullable=True,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    @classmethod
    async def encrypt_client_secret(
        cls, id: UUID, client_secret: str | None
    ) -> EncryptedString | None:
        if client_secret is None:
            return None
        return await EncryptedString.encrypt(
            client_secret,
            context={
                **ORGANIZATION_SSO_CONNECTION_CLIENT_SECRET_CONTEXT,
                "id": str(id),
            },
        )

    async def get_client_secret(self) -> str | None:
        if self.client_secret_encrypted is None:
            return None
        return await self.client_secret_encrypted.decrypt(id=str(self.id))
