from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import UrlConstraints
from pydantic_core import Url

from polar.kit.schemas import Schema

HttpsUrl = Annotated[
    Url,
    UrlConstraints(
        max_length=2083,
        allowed_schemes=["https"],
        host_required=True,
    ),
]


class WebhookEndpoint(Schema):
    id: UUID
    url: str
    user_id: UUID | None
    organization_id: UUID | None


class WebhookEndpointUpdate(Schema):
    url: str | None = None
    secret: str | None = None


class WebhookEndpointCreate(Schema):
    url: HttpsUrl
    secret: str
    user_id: UUID | None = None
    organization_id: UUID | None = None


class WebhookEvent(Schema):
    id: UUID
    created_at: datetime
    last_http_code: int | None
    succeeded: bool | None
    payload: str


class WebhookDelivery(Schema):
    id: UUID
    http_code: int | None
    succeeded: bool
    event: WebhookEvent
