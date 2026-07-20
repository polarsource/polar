from typing import Annotated, Any, Literal

from pydantic import (
    UUID4,
    BeforeValidator,
    Discriminator,
    Field,
    StringConstraints,
    field_validator,
)

from polar.kit.schemas import (
    EmptyStrToNone,
    HttpsUrl,
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OrganizationSSOConnectionType,
)

from .discovery import DISCOVERY_PATH

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def _strip_discovery_path(value: Any) -> Any:
    """Accept the discovery URL where the issuer is expected: it's what providers
    document and what people paste."""
    if isinstance(value, str):
        return value.strip().removesuffix(DISCOVERY_PATH)
    return value


IssuerUrl = Annotated[HttpsUrl, BeforeValidator(_strip_discovery_path)]

RESERVED_AUTHORIZATION_PARAMETERS = {
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "nonce",
    "code_challenge",
    "code_challenge_method",
}

AuthorizationParameters = Annotated[
    dict[
        Annotated[str, StringConstraints(pattern=r"^[a-zA-Z0-9_.-]{1,64}$")],
        Annotated[str, StringConstraints(max_length=256)],
    ],
    Field(max_length=10),
]

AUTHORIZATION_PARAMETERS_DESCRIPTION = (
    "Additional parameters appended to the authorization request, "
    "e.g. `hd` to pin a Google Workspace domain."
)


class OIDCConfigurationBase(Schema):
    issuer: IssuerUrl = Field(description="OIDC issuer URL of the identity provider.")
    client_id: NonEmptyStr = Field(
        description="OAuth client ID registered with the identity provider."
    )
    authorization_parameters: AuthorizationParameters = Field(
        default_factory=dict, description=AUTHORIZATION_PARAMETERS_DESCRIPTION
    )

    @field_validator("authorization_parameters")
    @classmethod
    def validate_authorization_parameters(cls, value: dict[str, str]) -> dict[str, str]:
        for key in value:
            if key in RESERVED_AUTHORIZATION_PARAMETERS:
                raise ValueError(f"`{key}` is set by Polar and can't be overridden.")
        return value


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
    authorization_parameters: dict[str, str] = Field(
        default_factory=dict, description=AUTHORIZATION_PARAMETERS_DESCRIPTION
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
    name: EmptyStrToNone = Field(
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
    name: EmptyStrToNone = Field(
        default=None,
        description="Human-friendly label for the connection, shown on the login page.",
    )
    configuration: OIDCConfiguration | None = Field(
        default=None, description="Provider-specific configuration of the connection."
    )
    enabled: bool | None = Field(
        default=None, description="Whether the connection can be used to sign in."
    )
