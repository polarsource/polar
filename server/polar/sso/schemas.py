from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, Field, StringConstraints

from polar.kit.schemas import HttpsUrl, IDSchema, Schema, TimestampedSchema
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OrganizationSSOConnectionType,
)

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class OIDCConfigurationBase(Schema):
    issuer: HttpsUrl = Field(description="OIDC issuer URL of the identity provider.")
    client_id: NonEmptyStr = Field(
        description="OAuth client ID registered with the identity provider."
    )


class OIDCConfigurationClientSecret(OIDCConfigurationBase):
    auth_method: Literal[OIDCAuthMethod.client_secret] = Field(
        description="Authentication method used against the identity provider."
    )
    client_secret: NonEmptyStr = Field(
        description="Client secret used to authenticate against the identity provider."
    )


class OIDCConfigurationPrivateKeyJWT(OIDCConfigurationBase):
    auth_method: Literal[OIDCAuthMethod.private_key_jwt] = Field(
        description="Authentication method used against the identity provider."
    )


OIDCConfiguration = Annotated[
    OIDCConfigurationClientSecret | OIDCConfigurationPrivateKeyJWT,
    Discriminator("auth_method"),
]


class OIDCConfigurationRead(Schema):
    issuer: str = Field(description="OIDC issuer URL of the identity provider.")
    client_id: str = Field(
        description="OAuth client ID registered with the identity provider."
    )
    auth_method: OIDCAuthMethod = Field(
        description="Authentication method used against the identity provider."
    )


class OrganizationSSOConnection(IDSchema, TimestampedSchema):
    organization_id: UUID4 = Field(
        description="ID of the organization the connection belongs to."
    )
    name: str | None = Field(
        description="Human-friendly label for the connection, shown on the login page."
    )
    type: OrganizationSSOConnectionType = Field(
        description="Type of the SSO connection."
    )
    configuration: OIDCConfigurationRead = Field(
        description="Provider-specific configuration of the connection."
    )
    enabled: bool = Field(description="Whether the connection can be used to sign in.")


class OrganizationSSOConnectionCreate(Schema):
    name: NonEmptyStr | None = Field(
        default=None,
        description="Human-friendly label for the connection, shown on the login page.",
    )
    type: Literal[OrganizationSSOConnectionType.oidc] = Field(
        default=OrganizationSSOConnectionType.oidc,
        description="Type of the SSO connection.",
    )
    configuration: OIDCConfiguration = Field(
        description="Provider-specific configuration of the connection."
    )
    enabled: bool = Field(
        default=False, description="Whether the connection can be used to sign in."
    )


class OrganizationSSOConnectionUpdate(Schema):
    name: NonEmptyStr | None = Field(
        default=None,
        description="Human-friendly label for the connection, shown on the login page.",
    )
    configuration: OIDCConfiguration | None = Field(
        default=None, description="Provider-specific configuration of the connection."
    )
    enabled: bool | None = Field(
        default=None, description="Whether the connection can be used to sign in."
    )
