import inspect
import typing
from inspect import Parameter, Signature
from typing import Annotated, Any, Literal, Union, get_args

from fastapi import FastAPI
from makefun import with_signature
from pydantic import Discriminator, TypeAdapter

from polar.benefit.schemas import Benefit as BenefitSchema
from polar.donation.schemas import Donation as DonationSchema
from polar.kit.schemas import Schema
from polar.models.benefit import Benefit
from polar.models.donation import Donation
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.product import Product
from polar.models.subscription import Subscription
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.schemas import Organization as OrganizationSchema
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.product.schemas import Product as ProductSchema
from polar.subscription.schemas import Subscription as SubscriptionSchema

WebhookTypeObject = Union[  # noqa: UP007
    tuple[Literal[WebhookEventType.subscription_created], Subscription],
    tuple[Literal[WebhookEventType.subscription_updated], Subscription],
    tuple[Literal[WebhookEventType.product_created], Product],
    tuple[Literal[WebhookEventType.product_updated], Product],
    tuple[Literal[WebhookEventType.pledge_created], Pledge],
    tuple[Literal[WebhookEventType.pledge_updated], Pledge],
    tuple[Literal[WebhookEventType.donation_created], Donation],
    tuple[Literal[WebhookEventType.organization_updated], Organization],
    tuple[Literal[WebhookEventType.benefit_created], Benefit],
    tuple[Literal[WebhookEventType.benefit_updated], Benefit],
]


class BaseWebhookPayload(Schema):
    type: WebhookEventType
    data: Schema


class WebhookSubscriptionCreatedPayload(BaseWebhookPayload):
    """Sent when a new subscription is created."""

    type: Literal[WebhookEventType.subscription_created]
    data: SubscriptionSchema


class WebhookSubscriptionUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a new subscription is updated. This event fires if the subscription is cancelled, both immediately and if the subscription is cancelled at the end of the current period."""

    type: Literal[WebhookEventType.subscription_updated]
    data: SubscriptionSchema


class WebhookProductCreatedPayload(BaseWebhookPayload):
    """Sent when a new product is created."""

    type: Literal[WebhookEventType.product_created]
    data: ProductSchema


class WebhookProductUpdatedPayload(BaseWebhookPayload):
    """Sent when a product is updated."""

    type: Literal[WebhookEventType.product_updated]
    data: ProductSchema


class WebhookPledgeCreatedPayload(BaseWebhookPayload):
    """Sent when a new pledge is created. Note that this does mean that the pledge has been paid yet."""

    type: Literal[WebhookEventType.pledge_created]
    data: PledgeSchema


class WebhookPledgeUpdatedPayload(BaseWebhookPayload):
    """Sent when a pledge is updated."""

    type: Literal[WebhookEventType.pledge_updated]
    data: PledgeSchema


class WebhookDonationCreatedPayload(BaseWebhookPayload):
    """Sent when a new donation is created."""

    type: Literal[WebhookEventType.donation_created]
    data: DonationSchema


class WebhookOrganizationUpdatedPayload(BaseWebhookPayload):
    """Sent when a organization is updated."""

    type: Literal[WebhookEventType.organization_updated]
    data: OrganizationSchema


class WebhookBenefitCreatedPayload(BaseWebhookPayload):
    """Sent when a new benefit is created."""

    type: Literal[WebhookEventType.benefit_created]
    data: BenefitSchema


class WebhookBenefitUpdatedPayload(BaseWebhookPayload):
    """Sent when a benefit is updated."""

    type: Literal[WebhookEventType.benefit_updated]
    data: BenefitSchema


WebhookPayload = Annotated[
    WebhookSubscriptionCreatedPayload
    | WebhookSubscriptionUpdatedPayload
    | WebhookProductCreatedPayload
    | WebhookProductUpdatedPayload
    | WebhookPledgeCreatedPayload
    | WebhookPledgeUpdatedPayload
    | WebhookDonationCreatedPayload
    | WebhookOrganizationUpdatedPayload
    | WebhookBenefitCreatedPayload
    | WebhookBenefitUpdatedPayload,
    Discriminator(discriminator="type"),
]
WebhookPayloadTypeAdapter: TypeAdapter[WebhookPayload] = TypeAdapter(WebhookPayload)


def _document_webhooks(app: FastAPI) -> None:
    def _endpoint(body: Any) -> None: ...

    webhooks_schemas: tuple[type[BaseWebhookPayload]] = typing.get_args(
        typing.get_args(WebhookPayload)[0]
    )
    for webhook_schema in webhooks_schemas:
        signature = Signature(
            [
                Parameter(
                    name="body",
                    kind=Parameter.POSITIONAL_OR_KEYWORD,
                    annotation=webhook_schema,
                )
            ]
        )

        event_type_annotation = webhook_schema.model_fields["type"].annotation
        event_type: WebhookEventType = get_args(event_type_annotation)[0]

        endpoint = with_signature(signature)(_endpoint)

        app.webhooks.add_api_route(
            event_type,
            endpoint,
            methods=["POST"],
            summary=event_type,
            description=inspect.getdoc(webhook_schema),
        )


app = FastAPI()
_document_webhooks(app)
