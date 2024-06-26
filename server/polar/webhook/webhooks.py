from typing import Literal, Union

from fastapi import FastAPI

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

app = FastAPI()


class WebhookSubscriptionCreatedPayload(Schema):
    type: Literal[WebhookEventType.subscription_created]
    data: SubscriptionSchema


@app.webhooks.post(
    WebhookEventType.subscription_created.value,
    description="Sent when a new subscription is created.",
)
async def subscription_created(body: WebhookSubscriptionCreatedPayload) -> None:
    return None


class WebhookSubscriptionUpdatedPayload(Schema):
    type: Literal[WebhookEventType.subscription_updated]
    data: SubscriptionSchema


@app.webhooks.post(
    WebhookEventType.subscription_updated.value,
    description="Sent when a new subscription is updated. This event fires if the subscription is cancelled, both immediately and if the subscription is cancelled at the end of the current period.",
)
async def subscription_updated(body: WebhookSubscriptionUpdatedPayload) -> None:
    return None


class WebhookProductCreatedPayload(Schema):
    type: Literal[WebhookEventType.product_created]
    data: ProductSchema


@app.webhooks.post(
    WebhookEventType.product_created.value,
    description="Sent when a new product is created.",
)
async def product_created(
    body: WebhookProductCreatedPayload,
) -> None:
    return None


class WebhookProductUpdatedPayload(Schema):
    type: Literal[WebhookEventType.product_updated]
    data: ProductSchema


@app.webhooks.post(
    WebhookEventType.product_updated.value,
    description="Sent when a product is updated.",
)
async def product_updated(
    body: WebhookProductUpdatedPayload,
) -> None:
    return None


class WebhookPledgeCreatedPayload(Schema):
    type: Literal[WebhookEventType.pledge_created]
    data: PledgeSchema


@app.webhooks.post(
    WebhookEventType.pledge_created.value,
    description="Sent when a new pledge is created. Note that this does mean that the pledge has been paid yet.",
)
async def pledge_created(body: WebhookPledgeCreatedPayload) -> None:
    return None


class WebhookPledgeUpdatedPayload(Schema):
    type: Literal[WebhookEventType.pledge_updated]
    data: PledgeSchema


@app.webhooks.post(
    WebhookEventType.pledge_updated.value,
    description="Sent when a pledge is updated.",
)
async def pledge_updated(body: WebhookPledgeUpdatedPayload) -> None:
    return None


class WebhookDonationCreatedPayload(Schema):
    type: Literal[WebhookEventType.donation_created]
    data: DonationSchema


@app.webhooks.post(
    WebhookEventType.donation_created.value,
    description="Sent when a new donation is created.",
)
async def donation_created(body: WebhookDonationCreatedPayload) -> None:
    return None


class WebhookOrganizationUpdatedPayload(Schema):
    type: Literal[WebhookEventType.organization_updated]
    data: OrganizationSchema


@app.webhooks.post(
    WebhookEventType.organization_updated.value,
    description="Sent when a organization is updated.",
)
async def organization_updated(body: WebhookOrganizationUpdatedPayload) -> None:
    return None


class WebhookBenefitCreatedPayload(Schema):
    type: Literal[WebhookEventType.benefit_created]
    data: BenefitSchema


@app.webhooks.post(
    WebhookEventType.benefit_created.value,
    description="Sent when a new benefit is created.",
)
async def benefit_created(body: WebhookBenefitCreatedPayload) -> None:
    return None


class WebhookBenefitUpdatedPayload(Schema):
    type: Literal[WebhookEventType.benefit_updated]
    data: BenefitSchema


@app.webhooks.post(
    WebhookEventType.benefit_updated.value,
    description="Sent when a benefit is updated.",
)
async def benefit_updated(body: WebhookBenefitUpdatedPayload) -> None:
    return None


WebhookPayload = Union[  # noqa: UP007
    WebhookSubscriptionCreatedPayload,
    WebhookSubscriptionUpdatedPayload,
    WebhookProductCreatedPayload,
    WebhookProductUpdatedPayload,
    WebhookPledgeCreatedPayload,
    WebhookPledgeUpdatedPayload,
    WebhookDonationCreatedPayload,
    WebhookOrganizationUpdatedPayload,
    WebhookBenefitCreatedPayload,
    WebhookBenefitUpdatedPayload,
]
