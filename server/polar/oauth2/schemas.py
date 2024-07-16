import ipaddress
import re
from typing import Annotated, Literal

from pydantic import (
    UUID4,
    AfterValidator,
    BeforeValidator,
    Discriminator,
    EmailStr,
    HttpUrl,
    TypeAdapter,
)

from polar.auth.scope import SCOPES_SUPPORTED, Scope, scope_to_list
from polar.kit.schemas import Schema, TimestampedSchema

from .sub_type import SubType

_LOCALHOST_HOST_PATTERN = re.compile(r"([^\.]+\.)?localhost(\d+)?", flags=re.IGNORECASE)


def _is_localhost(host: str) -> bool:
    try:
        return ipaddress.IPv4Address(host).is_private
    except ValueError:
        return _LOCALHOST_HOST_PATTERN.match(host) is not None


def _is_https_or_localhost(value: HttpUrl) -> HttpUrl:
    if value.scheme == "http" and (value.host is None or not _is_localhost(value.host)):
        raise ValueError("An HTTPS URL is required.")
    return value


HttpsUrlOrLocalhost = Annotated[HttpUrl, AfterValidator(_is_https_or_localhost)]
Scopes = Annotated[list[Scope], BeforeValidator(scope_to_list)]


class OAuth2ClientConfiguration(Schema):
    redirect_uris: list[HttpsUrlOrLocalhost]
    token_endpoint_auth_method: Literal[
        "client_secret_basic", "client_secret_post", "none"
    ] = "client_secret_post"
    grant_types: list[Literal["authorization_code", "refresh_token"]] = [
        "authorization_code",
        "refresh_token",
    ]
    response_types: list[Literal["code"]] = ["code"]
    scope: str = " ".join(SCOPES_SUPPORTED)
    client_name: str
    client_uri: str | None = None
    logo_uri: HttpUrl | None = None
    tos_uri: HttpUrl | None = None
    policy_uri: HttpUrl | None = None


class OAuth2ClientConfigurationUpdate(OAuth2ClientConfiguration):
    client_id: str


class OAuth2Client(TimestampedSchema, OAuth2ClientConfiguration):
    client_id: str
    client_secret: str
    client_id_issued_at: int
    client_secret_expires_at: int


class OAuth2ClientPublic(TimestampedSchema):
    client_id: str
    client_name: str | None = None
    client_uri: str | None = None
    logo_uri: str | None = None
    tos_uri: str | None = None
    policy_uri: str | None = None


class AuthorizeUser(Schema):
    id: UUID4
    username: str
    email: EmailStr
    avatar_url: str | None = None


class AuthorizeOrganization(Schema):
    id: UUID4
    slug: str
    avatar_url: str


class AuthorizeResponseBase(Schema):
    client: OAuth2ClientPublic
    sub_type: SubType
    sub: AuthorizeUser | AuthorizeOrganization | None = None
    scopes: Scopes


class AuthorizeResponseUser(AuthorizeResponseBase):
    sub_type: Literal[SubType.user]
    sub: AuthorizeUser | None = None


class AuthorizeResponseOrganization(AuthorizeResponseBase):
    sub_type: Literal[SubType.organization]
    sub: AuthorizeOrganization | None = None
    organizations: list[AuthorizeOrganization]


AuthorizeResponse = Annotated[
    AuthorizeResponseUser | AuthorizeResponseOrganization,
    Discriminator(discriminator="sub_type"),
]

authorize_response_adapter: TypeAdapter[AuthorizeResponse] = TypeAdapter(
    AuthorizeResponse
)


class TokenRequestBase(Schema):
    grant_type: Literal["authorization_code", "refresh_token"]
    client_id: str
    client_secret: str


class AuthorizationCodeTokenRequest(TokenRequestBase):
    grant_type: Literal["authorization_code"]
    code: str
    redirect_uri: HttpUrl


class RefreshTokenRequest(TokenRequestBase):
    grant_type: Literal["refresh_token"]

    refresh_token: str


TokenRequest = Annotated[
    AuthorizationCodeTokenRequest | RefreshTokenRequest, Discriminator("grant_type")
]
TokenRequestAdapter: TypeAdapter[TokenRequest] = TypeAdapter(TokenRequest)


class TokenResponse(Schema):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    refresh_token: str | None = None
    scope: str
    id_token: str


class RevokeTokenRequest(Schema):
    token: str
    token_type_hint: Literal["access_token", "refresh_token"] | None = None
    client_id: str
    client_secret: str


class RevokeTokenResponse(Schema): ...


class IntrospectTokenRequest(Schema):
    token: str
    token_type_hint: Literal["access_token", "refresh_token"] | None = None
    client_id: str
    client_secret: str


class IntrospectTokenResponse(Schema):
    active: bool
    client_id: str
    token_type: Literal["access_token", "refresh_token"]
    scope: str
    sub_type: SubType
    sub: str
    aud: str
    iss: str
    exp: int
    iat: int


class UserInfoUser(Schema):
    sub: str
    name: str | None = None
    email: str | None = None
    email_verified: bool | None = None


class UserInfoOrganization(Schema):
    sub: str
    name: str | None = None


UserInfo = UserInfoUser | UserInfoOrganization
