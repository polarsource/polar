from typing import Annotated

from pydantic import UUID4, BeforeValidator

from polar.authz.scope import Scope, scope_to_list
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


Scopes = Annotated[list[Scope], BeforeValidator(scope_to_list)]


class AuthorizeResponse(Schema):
    client: OAuth2Client
    scopes: Scopes
