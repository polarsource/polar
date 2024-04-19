from enum import Enum
from typing import Literal, Union

from fastapi import FastAPI

from polar.benefit.schemas import Benefit as BenefitSchema
from polar.donation.schemas import Donation as DonationSchema
from polar.kit.schemas import Schema
from polar.models.benefit import Benefit
from polar.models.donation import Donation
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.subscription import Subscription
from polar.models.subscription_tier import SubscriptionTier
from polar.organization.schemas import Organization as OrganizationSchema
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.subscription.schemas import Subscription as SubscriptionSchema
from polar.subscription.schemas import SubscriptionTier as SubscriptionTierSchema


class WebhookEventType(Enum):
    subscription_created = "subscription.created"
    subscription_updated = "subscription.updated"
    subscription_tier_created = "subscription_tier.created"
    subscription_tier_updated = "subscription_tier.updated"
    benefit_created = "benefit.created"
    benefit_updated = "benefit.updated"
    organization_updated = "organization.updated"
    pledge_created = "pledge.created"
    pledge_updated = "pledge.updated"
    donation_created = "donation.created"


WebhookTypeObject = Union[  # noqa: UP007
    tuple[Literal[WebhookEventType.subscription_created], Subscription],
    tuple[Literal[WebhookEventType.subscription_updated], Subscription],
    tuple[Literal[WebhookEventType.subscription_tier_created], SubscriptionTier],
    tuple[Literal[WebhookEventType.subscription_tier_updated], SubscriptionTier],
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


@app.webhooks.post(WebhookEventType.subscription_created.value)
async def subscription_created(body: WebhookSubscriptionCreatedPayload) -> None:
    return None


class WebhookSubscriptionUpdatedPayload(Schema):
    type: Literal[WebhookEventType.subscription_updated]
    data: SubscriptionSchema


@app.webhooks.post(WebhookEventType.subscription_updated.value)
async def subscription_updated(body: WebhookSubscriptionUpdatedPayload) -> None:
    return None


class WebhookSubscriptionTierCreatedPayload(Schema):
    type: Literal[WebhookEventType.subscription_tier_created]
    data: SubscriptionTierSchema


@app.webhooks.post(WebhookEventType.subscription_tier_created.value)
async def subscription_tier_created(
    body: WebhookSubscriptionTierCreatedPayload,
) -> None:
    return None


class WebhookSubscriptionTierUpdatedPayload(Schema):
    type: Literal[WebhookEventType.subscription_tier_updated]
    data: SubscriptionTierSchema


@app.webhooks.post(WebhookEventType.subscription_tier_updated.value)
async def subscription_tier_updated(
    body: WebhookSubscriptionTierUpdatedPayload,
) -> None:
    return None


class WebhookPledgeCreatedPayload(Schema):
    type: Literal[WebhookEventType.pledge_created]
    data: PledgeSchema


@app.webhooks.post(WebhookEventType.pledge_created.value)
async def pledge_created(body: WebhookPledgeCreatedPayload) -> None:
    return None


class WebhookPledgeUpdatedPayload(Schema):
    type: Literal[WebhookEventType.pledge_updated]
    data: PledgeSchema


@app.webhooks.post(WebhookEventType.pledge_updated.value)
async def pledge_updated(body: WebhookPledgeUpdatedPayload) -> None:
    return None


class WebhookDonationCreatedPayload(Schema):
    type: Literal[WebhookEventType.donation_created]
    data: DonationSchema


@app.webhooks.post(WebhookEventType.donation_created.value)
async def donation_created(body: WebhookDonationCreatedPayload) -> None:
    return None


class WebhookOrganizationUpdatedPayload(Schema):
    type: Literal[WebhookEventType.organization_updated]
    data: OrganizationSchema


@app.webhooks.post(WebhookEventType.organization_updated.value)
async def organization_updated(body: WebhookOrganizationUpdatedPayload) -> None:
    return None


class WebhookBenefitCreatedPayload(Schema):
    type: Literal[WebhookEventType.benefit_created]
    data: BenefitSchema


@app.webhooks.post(WebhookEventType.benefit_created.value)
async def benefit_created(body: WebhookBenefitCreatedPayload) -> None:
    return None


class WebhookBenefitUpdatedPayload(Schema):
    type: Literal[WebhookEventType.benefit_updated]
    data: BenefitSchema


@app.webhooks.post(WebhookEventType.benefit_updated.value)
async def benefit_updated(body: WebhookBenefitUpdatedPayload) -> None:
    return None


WebhookPayload = Union[  # noqa: UP007
    WebhookSubscriptionCreatedPayload,
    WebhookSubscriptionUpdatedPayload,
    WebhookSubscriptionTierCreatedPayload,
    WebhookSubscriptionTierUpdatedPayload,
    WebhookPledgeCreatedPayload,
    WebhookPledgeUpdatedPayload,
    WebhookDonationCreatedPayload,
    WebhookOrganizationUpdatedPayload,
    WebhookBenefitCreatedPayload,
    WebhookBenefitUpdatedPayload,
]
