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

    event_subscription_created: bool = False
    event_subscription_updated: bool = False
    event_subscription_tier_created: bool = False
    event_subscription_tier_updated: bool = False
    event_pledge_created: bool = False
    event_pledge_updated: bool = False
    event_donation_created: bool = False
    event_organization_updated: bool = False


class WebhookEndpointUpdate(Schema):
    url: str | None = None
    secret: str | None = None

    event_subscription_created: bool | None = None
    event_subscription_updated: bool | None = None
    event_subscription_tier_created: bool | None = None
    event_subscription_tier_updated: bool | None = None
    event_pledge_created: bool | None = None
    event_pledge_updated: bool | None = None
    event_donation_created: bool | None = None
    event_organization_updated: bool | None = None


class WebhookEndpointCreate(Schema):
    url: HttpsUrl
    secret: str
    user_id: UUID | None = None
    organization_id: UUID | None = None

    event_subscription_created: bool | None = None
    event_subscription_updated: bool | None = None
    event_subscription_tier_created: bool | None = None
    event_subscription_tier_updated: bool | None = None
    event_pledge_created: bool | None = None
    event_pledge_updated: bool | None = None
    event_donation_created: bool | None = None
    event_organization_updated: bool | None = None


class WebhookEvent(Schema):
    id: UUID
    created_at: datetime
    last_http_code: int | None
    succeeded: bool | None
    payload: str


class WebhookDelivery(Schema):
    id: UUID
    created_at: datetime
    http_code: int | None
    succeeded: bool
    webhook_event: WebhookEvent
