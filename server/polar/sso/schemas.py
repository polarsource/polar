from typing import Annotated, Literal, Self

from pydantic import (
    UUID4,
    AfterValidator,
    AnyUrl,
    Field,
    StringConstraints,
    TypeAdapter,
    ValidationError,
    model_validator,
)

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OrganizationSSOConnectionType,
)

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

_url_adapter: TypeAdapter[AnyUrl] = TypeAdapter(AnyUrl)


def _validate_https_url(value: str) -> str:
    try:
        url = _url_adapter.validate_python(value)
    except ValidationError as e:
        raise ValueError("must be a valid URL") from e
    if url.scheme != "https":
        raise ValueError("must be an HTTPS URL")
    return value.rstrip("/")


IssuerURL = Annotated[NonEmptyStr, AfterValidator(_validate_https_url)]


class OIDCConfiguration(Schema):
    type: Literal[OrganizationSSOConnectionType.oidc] = Field(
        default=OrganizationSSOConnectionType.oidc,
        description="Type of the SSO connection.",
    )
    issuer: IssuerURL = Field(description="OIDC issuer URL of the identity provider.")
    client_id: NonEmptyStr = Field(
        description="OAuth client ID registered with the identity provider."
    )
    auth_method: OIDCAuthMethod = Field(
        description="Authentication method used against the identity provider."
    )
    client_secret: NonEmptyStr | None = Field(
        default=None,
        description="Client secret; required for the `client_secret` auth method.",
    )

    @model_validator(mode="after")
    def validate_auth_method(self) -> Self:
        if self.auth_method == OIDCAuthMethod.client_secret and not self.client_secret:
            raise ValueError("client_secret is required for client_secret auth method")
        if self.auth_method == OIDCAuthMethod.private_key_jwt and self.client_secret:
            raise ValueError("client_secret must not be set for private_key_jwt")
        return self


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
    type: OrganizationSSOConnectionType = Field(
        description="Type of the SSO connection."
    )
    configuration: OIDCConfigurationRead = Field(
        description="Provider-specific configuration of the connection."
    )
    enabled: bool = Field(description="Whether the connection can be used to sign in.")


class OrganizationSSOConnectionCreate(Schema):
    configuration: OIDCConfiguration = Field(
        description="Provider-specific configuration of the connection."
    )
    enabled: bool = Field(
        default=True, description="Whether the connection can be used to sign in."
    )


class OrganizationSSOConnectionUpdate(Schema):
    configuration: OIDCConfiguration | None = Field(
        default=None, description="Provider-specific configuration of the connection."
    )
    enabled: bool | None = Field(
        default=None, description="Whether the connection can be used to sign in."
    )
