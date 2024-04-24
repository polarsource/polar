from typing import Annotated, Literal

from pydantic import UUID4, BeforeValidator, Discriminator, EmailStr, TypeAdapter

from polar.auth.scope import Scope, scope_to_list
from polar.enums import Platforms
from polar.kit.schemas import Schema, TimestampedSchema

from .sub_type import SubType


class OAuth2ClientMetadata(Schema):
    client_name: str | None = None
    client_uri: str | None = None
    logo_uri: str | None = None
    tos_uri: str | None = None
    policy_uri: str | None = None


class OAuth2Client(TimestampedSchema):
    id: UUID4
    client_id: str
    client_metadata: OAuth2ClientMetadata


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
    client: OAuth2Client
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
