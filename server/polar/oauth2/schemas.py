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

from polar.auth.scope import RESERVED_SCOPES, Scope, scope_to_list
from polar.enums import Platforms
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


class OAuth2ClientConfiguration(Schema):
    redirect_uris: list[HttpsUrlOrLocalhost]
    token_endpoint_auth_method: Literal["client_secret_post"] = "client_secret_post"
    grant_types: list[Literal["authorization_code", "refresh_token"]] = [
        "authorization_code",
        "refresh_token",
    ]
    response_types: list[Literal["code"]] = ["code"]
    scope: list[Scope] = [s for s in Scope if s not in RESERVED_SCOPES]
    client_name: str
    client_uri: str | None = None
    logo_uri: HttpUrl | None = None
    tos_uri: HttpUrl | None = None
    policy_uri: HttpUrl | None = None


class OAuth2ClientConfigurationUpdate(OAuth2ClientConfiguration):
    client_id: str


class OAuth2ClientPublic(TimestampedSchema):
    id: UUID4
    client_id: str
    client_name: str | None = None
    client_uri: str | None = None
    logo_uri: str | None = None
    tos_uri: str | None = None
    policy_uri: str | None = None


Scopes = Annotated[list[Scope], BeforeValidator(scope_to_list)]


class AuthorizeUser(Schema):
    id: UUID4
    username: str
    email: EmailStr
    avatar_url: str | None = None


class AuthorizeOrganization(Schema):
    id: UUID4
    platform: Platforms
    name: str
    avatar_url: str
    is_personal: bool


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
