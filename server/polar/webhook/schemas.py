import ipaddress
from typing import Annotated

import idna
from pydantic import UUID4, AfterValidator, AnyUrl, BeforeValidator, Field
from pydantic.json_schema import SkipJsonSchema

from polar.kit.schemas import (
    HttpsUrl,
    IDSchema,
    MergeJSONSchema,
    Schema,
    TimestampedSchema,
)
from polar.kit.versioning import APIVersion
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.organization.schemas import OrganizationID
from polar.version import CURRENT_API_VERSION, VERSIONS

LOCALHOST_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "[::1]"}


def _is_blocked_webhook_host(host: str) -> bool:
    if host.lower() in LOCALHOST_HOSTS:
        return True
    clean = host.strip("[]")
    try:
        return not ipaddress.ip_address(clean).is_global
    except ValueError:
        return False


def _is_valid_webhook_hostname(host: str) -> bool:
    clean = host.strip("[]")
    try:
        ipaddress.ip_address(clean)
        return True
    except ValueError:
        pass
    try:
        idna.encode(host)
    except idna.IDNAError:
        return False
    return True


def validate_hostname(url: AnyUrl) -> AnyUrl:
    if not url.host:
        return url
    if not _is_valid_webhook_hostname(url.host):
        raise ValueError(
            "Invalid webhook URL: the hostname contains characters not allowed in domain names."
        )
    if _is_blocked_webhook_host(url.host):
        raise ValueError(
            "Webhook URLs cannot point to localhost or private IP addresses."
        )
    return url


ENDPOINT_URL_DESCRIPTION = "The URL where the webhook events will be sent."
ENDPOINT_URL_EXAMPLES = ["https://webhook.site/cb791d80-f26e-4f8c-be88-6e56054192b0"]

EndpointURL = Annotated[
    HttpsUrl,
    Field(description=ENDPOINT_URL_DESCRIPTION, examples=ENDPOINT_URL_EXAMPLES),
    BeforeValidator(lambda v: v.strip() if isinstance(v, str) else v),
    AfterValidator(validate_hostname),
]
EndpointFormat = Annotated[
    WebhookFormat,
    Field(description="The format of the webhook payload."),
]
EndpointSecret = Annotated[
    str,
    Field(
        description="The secret used to sign the webhook events.",
        examples=["whsec_ovyN6cPrTv56AApvzCaJno08SSmGJmgbWilb33N2JuK"],
    ),
]
EndpointEvents = Annotated[
    list[WebhookEventType],
    Field(description="The events that will trigger the webhook."),
]


def _is_available_version(api_version: APIVersion) -> APIVersion:
    if api_version not in VERSIONS:
        raise ValueError(f"Invalid API version: {api_version}")
    return api_version


AvailableAPIVersion = Annotated[
    APIVersion,
    MergeJSONSchema({"enum": [str(version) for version in sorted(VERSIONS)]}),
    AfterValidator(_is_available_version),
]


class WebhookEndpoint(IDSchema, TimestampedSchema):
    """
    A webhook endpoint.
    """

    url: str = Field(
        description=ENDPOINT_URL_DESCRIPTION, examples=ENDPOINT_URL_EXAMPLES
    )
    name: str | None = Field(
        default=None,
        description="An optional name for the webhook endpoint to help organize and identify it.",
    )
    api_version: APIVersion = Field(
        description="The API version that'll be used in event payloads."
    )
    format: EndpointFormat
    secret: EndpointSecret
    organization_id: UUID4 = Field(
        description="The organization ID associated with the webhook endpoint."
    )
    events: EndpointEvents
    enabled: bool = Field(
        description="Whether the webhook endpoint is enabled and will receive events."
    )


class WebhookEndpointCreate(Schema):
    """
    Schema to create a webhook endpoint.
    """

    url: EndpointURL
    name: str | None = Field(
        default=None,
        description="An optional name for the webhook endpoint to help organize and identify it.",
    )
    api_version: AvailableAPIVersion = Field(
        default=str(CURRENT_API_VERSION),  # type: ignore
        description="The API version that'll be used in event payloads.",
    )
    format: EndpointFormat
    events: EndpointEvents
    organization_id: OrganizationID | None = Field(
        None,
        description=(
            "The organization ID associated with the webhook endpoint. "
            "**Required unless you use an organization token.**"
        ),
    )


class DeprecatedWebhookEndpointCreateWithSecret(WebhookEndpointCreate):
    secret: SkipJsonSchema[EndpointSecret | None] = Field(
        default=None,
        deprecated="The secret is now generated on the backend.",
        min_length=32,
    )


class WebhookEndpointUpdate(Schema):
    """
    Schema to update a webhook endpoint.
    """

    url: EndpointURL | None = None
    name: str | None = Field(
        default=None,
        description="An optional name for the webhook endpoint to help organize and identify it.",
    )
    api_version: AvailableAPIVersion | None = Field(
        default=None, description="The API version that'll be used in event payloads."
    )
    format: EndpointFormat | None = None
    events: EndpointEvents | None = None
    enabled: bool | None = Field(
        default=None, description="Whether the webhook endpoint is enabled."
    )


class DeprecatedWebhookEndpointUpdateWithSecret(WebhookEndpointUpdate):
    secret: SkipJsonSchema[EndpointSecret | None] = Field(
        default=None,
        deprecated="The secret should is now generated on the backend.",
        min_length=32,
    )


class WebhookEvent(IDSchema, TimestampedSchema):
    """
    A webhook event.

    An event represent something that happened in the system
    that should be sent to the webhook endpoint.

    It can be delivered multiple times until it's marked as succeeded,
    each one creating a new delivery.
    """

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
    skipped: bool = Field(
        description="Whether this event was skipped because the webhook endpoint was disabled."
    )
    api_version: APIVersion = Field(
        description="The API version used in the payload of this event."
    )
    payload: str | None = Field(description="The payload of the webhook event.")
    type: WebhookEventType = Field(description="The type of the webhook event.")
    is_archived: bool = Field(
        description=(
            "Whether this event is archived. "
            "Archived events can't be redelivered, "
            "and the payload is not accessible anymore."
        ),
    )


class WebhookDelivery(IDSchema, TimestampedSchema):
    """
    A webhook delivery for a webhook event.
    """

    succeeded: bool = Field(description="Whether the delivery was successful.")
    http_code: int | None = Field(
        description="The HTTP code returned by the URL."
        " `null` if the endpoint was unreachable.",
    )
    response: str | None = Field(
        description=(
            "The response body returned by the URL, "
            "or the error message if the endpoint was unreachable."
        ),
    )
    webhook_event: WebhookEvent = Field(
        description="The webhook event sent by this delivery."
    )
