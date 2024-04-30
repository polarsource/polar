from typing import Annotated

from pydantic import UUID4, AnyUrl, PlainSerializer, UrlConstraints

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.webhook_endpoint import WebhookEventType

HttpsUrl = Annotated[
    AnyUrl,
    UrlConstraints(
        max_length=2083,
        allowed_schemes=["https"],
        host_required=True,
    ),
    PlainSerializer(lambda v: str(v), return_type=str),
]


class WebhookEndpoint(TimestampedSchema):
    id: UUID4
    url: str
    user_id: UUID4 | None
    organization_id: UUID4 | None
    events: list[WebhookEventType]


class WebhookEndpointUpdate(Schema):
    url: str | None = None
    secret: str | None = None
    events: list[WebhookEventType] | None = None


class WebhookEndpointCreate(Schema):
    url: HttpsUrl
    secret: str
    events: list[WebhookEventType]
    user_id: UUID4 | None = None
    organization_id: UUID4 | None = None


class WebhookEvent(TimestampedSchema):
    id: UUID4
    last_http_code: int | None = None
    succeeded: bool | None = None
    payload: str


class WebhookDelivery(TimestampedSchema):
    id: UUID4
    http_code: int | None = None
    succeeded: bool
    webhook_event: WebhookEvent
