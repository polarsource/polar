from typing import Annotated

from authlib.oauth2.rfc6749 import scope_to_list
from pydantic import UUID4, BeforeValidator

from polar.kit.schemas import Schema, TimestampedSchema


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


Scopes = Annotated[list[str], BeforeValidator(scope_to_list)]


class AuthorizeResponse(Schema):
    client: OAuth2Client
    scopes: Scopes
