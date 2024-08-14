from typing import Annotated

from pydantic import UUID4, AnyUrl, Field, PlainSerializer, UrlConstraints

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.organization.schemas import OrganizationID

HttpsUrl = Annotated[
    AnyUrl,
    UrlConstraints(
        max_length=2083,
        allowed_schemes=["https"],
        host_required=True,
    ),
    PlainSerializer(lambda v: str(v), return_type=str),
]

EndpointURL = Annotated[
    HttpsUrl,
    Field(
        description="The URL where the webhook events will be sent.",
        examples=["https://webhook.site/cb791d80-f26e-4f8c-be88-6e56054192b0"],
    ),
]
EndpointFormat = Annotated[
    WebhookFormat,
    Field(description="The format of the webhook payload."),
]
EndpointSecret = Annotated[
    str,
    Field(
        description="The secret used to sign the webhook events.",
        examples=["f_z6mfSpxkjogyw3FkA2aH2gYE5huxruNf34MpdWMcA"],
    ),
]
EndpointEvents = Annotated[
    list[WebhookEventType],
    Field(description="The events that will trigger the webhook."),
]


class WebhookEndpoint(TimestampedSchema):
    """
    A webhook endpoint.
    """

    id: UUID4 = Field(description="The webhook endpoint ID.")
    url: EndpointURL
    format: EndpointFormat
    user_id: UUID4 | None = Field(
        None, description=("The user ID associated with the webhook endpoint.")
    )
    organization_id: UUID4 | None = Field(
        None, description="The organization ID associated with the webhook endpoint."
    )
    events: EndpointEvents


class WebhookEndpointCreate(Schema):
    """
    Schema to create a webhook endpoint.
    """

    url: EndpointURL
    format: EndpointFormat
    secret: EndpointSecret
    events: EndpointEvents
    organization_id: OrganizationID | None = Field(
        None,
        description=(
            "The organization ID associated with the webhook endpoint. "
            "**Required unless you use an organization token.**"
        ),
    )


class WebhookEndpointUpdate(Schema):
    """
    Schema to update a webhook endpoint.
    """

    url: EndpointURL | None = None
    format: EndpointFormat | None = None
    secret: EndpointSecret | None = None
    events: EndpointEvents | None = None


class WebhookEvent(TimestampedSchema):
    """
    A webhook event.

    An event represent something that happened in the system
    that should be sent to the webhook endpoint.

    It can be delivered multiple times until it's marked as succeeded,
    each one creating a new delivery.
    """

    id: UUID4 = Field(description="The webhook event ID.")
    last_http_code: int | None = Field(
        None,
        description="Last HTTP code returned by the URL. "
        "`null` if no delviery has been attempted or if the endpoint was unreachable.",
    )
    succeeded: bool | None = Field(
        None,
        description=(
            "Whether this event was successfully delivered."
            " `null` if no delivery has been attempted."
        ),
    )
    payload: str = Field(description="The payload of the webhook event.")


class WebhookDelivery(TimestampedSchema):
    """
    A webhook delivery for a webhook event.
    """

    id: UUID4 = Field(description="The webhook delivery ID.")
    http_code: int | None = Field(
        None,
        description="The HTTP code returned by the URL."
        " `null` if the endpoint was unreachable.",
    )
    succeeded: bool = Field(description="Whether the delivery was successful.")
    webhook_event: WebhookEvent = Field(
        description="The webhook event sent by this delivery."
    )
