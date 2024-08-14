import inspect
import json
import typing
from inspect import Parameter, Signature
from typing import Annotated, Any, Literal, assert_never, get_args

from babel.dates import format_date
from fastapi import FastAPI
from makefun import with_signature
from pydantic import Discriminator, TypeAdapter

from polar.benefit.schemas import Benefit as BenefitSchema
from polar.donation.schemas import Donation as DonationSchema
from polar.exceptions import PolarError
from polar.kit.schemas import IDSchema, Schema
from polar.models import (
    Benefit,
    Donation,
    Order,
    Organization,
    Pledge,
    Product,
    Subscription,
    User,
)
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.order.schemas import Order as OrderSchema
from polar.organization.schemas import Organization as OrganizationSchema
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.product.schemas import Product as ProductSchema
from polar.subscription.schemas import Subscription as SubscriptionSchema

from .discord import DiscordEmbedField, DiscordPayload, get_branded_discord_embed
from .slack import SlackPayload, SlackText, get_branded_slack_payload

WebhookTypeObject = (
    tuple[Literal[WebhookEventType.order_created], Order]
    | tuple[Literal[WebhookEventType.subscription_created], Subscription]
    | tuple[Literal[WebhookEventType.subscription_updated], Subscription]
    | tuple[Literal[WebhookEventType.product_created], Product]
    | tuple[Literal[WebhookEventType.product_updated], Product]
    | tuple[Literal[WebhookEventType.pledge_created], Pledge]
    | tuple[Literal[WebhookEventType.pledge_updated], Pledge]
    | tuple[Literal[WebhookEventType.donation_created], Donation]
    | tuple[Literal[WebhookEventType.organization_updated], Organization]
    | tuple[Literal[WebhookEventType.benefit_created], Benefit]
    | tuple[Literal[WebhookEventType.benefit_updated], Benefit]
)


class UnsupportedTarget(PolarError):
    def __init__(
        self,
        target: User | Organization,
        schema: type["BaseWebhookPayload"],
        format: WebhookFormat,
    ) -> None:
        self.target = target
        self.format = format
        message = f"{schema.__name__} payload does not support target {type(target).__name__} for format {format}"
        super().__init__(message)


class SkipEvent(PolarError):
    def __init__(self, event: WebhookEventType, format: WebhookFormat) -> None:
        self.event = event
        self.format = format
        message = f"Skipping event {event} for format {format}"
        super().__init__(message)


class BaseWebhookPayload(Schema):
    type: WebhookEventType
    data: IDSchema

    def get_payload(self, format: WebhookFormat, target: User | Organization) -> str:
        match format:
            case WebhookFormat.raw:
                return self.get_raw_payload()
            case WebhookFormat.discord:
                return self.get_discord_payload(target)
            case WebhookFormat.slack:
                return self.get_slack_payload(target)
            case _:
                assert_never(format)

    def get_raw_payload(self) -> str:
        return self.model_dump_json()

    def get_discord_payload(self, target: User | Organization) -> str:
        # Generic Discord payload, override in subclasses for more specific payloads
        fields: list[DiscordEmbedField] = [
            {"name": "Object", "value": str(self.data.id)},
        ]
        if isinstance(target, User):
            fields.append({"name": "User", "value": target.email})
        elif isinstance(target, Organization):
            fields.append({"name": "Organization", "value": target.name})

        payload: DiscordPayload = {
            "content": self.type,
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": self.type,
                        "description": self.type,
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        # Generic Slack payload, override in subclasses for more specific payloads
        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Object*\n{self.data.id}"},
        ]
        if isinstance(target, User):
            fields.append({"type": "mrkdwn", "text": f"*User*\n{target.email}"})
        elif isinstance(target, Organization):
            fields.append({"type": "mrkdwn", "text": f"*Organization*\n{target.name}"})

        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": self.type,
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": self.type,
                        },
                        "fields": fields,
                    }
                ],
            }
        )

        return json.dumps(payload)


class WebhookOrderCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new order is created.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.order_created]
    data: OrderSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        price = self.data.product_price
        price_display = price.get_display_price()

        fields: list[DiscordEmbedField] = [
            {"name": "Product", "value": self.data.product.name},
            {"name": "Price", "value": price_display},
            {"name": "Customer", "value": self.data.user.email},
        ]
        if self.data.subscription is not None:
            fields.append({"name": "Subscription", "value": "Yes"})

        payload: DiscordPayload = {
            "content": "New Order",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "New Order",
                        "description": f"New order has been made to {target.name}.",
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        price = self.data.product_price
        price_display = price.get_display_price()

        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Product*\n{self.data.product.name}"},
            {"type": "mrkdwn", "text": f"*Price*\n{price_display}"},
            {"type": "mrkdwn", "text": f"*Customer*\n{self.data.user.email}"},
        ]
        if self.data.subscription is not None:
            fields.append({"type": "mrkdwn", "text": "*Subscription*\nYes"})

        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "New Order",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"New order has been made to {target.name}.",
                        },
                        "fields": fields,
                    }
                ],
            }
        )

        return json.dumps(payload)


class WebhookSubscriptionCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new subscription is created.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.subscription_created]
    data: SubscriptionSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        price = self.data.price
        if price is None:
            price_display = "Free"
        else:
            price_display = price.get_display_price()

        fields: list[DiscordEmbedField] = [
            {"name": "Product", "value": self.data.product.name},
            {"name": "Price", "value": price_display},
            {"name": "Customer", "value": self.data.user.email},
        ]
        payload: DiscordPayload = {
            "content": "New Subscription",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "New Subscription",
                        "description": f"New subscription has been made to {target.name}.",
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        price = self.data.price
        if price is None:
            price_display = "Free"
        else:
            price_display = price.get_display_price()

        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Product*\n{self.data.product.name}"},
            {"type": "mrkdwn", "text": f"*Price*\n{price_display}"},
            {"type": "mrkdwn", "text": f"*Customer*\n{self.data.user.email}"},
        ]
        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "New Subscription",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"New subscription has been made to {target.name}.",
                        },
                        "fields": fields,
                    }
                ],
            }
        )

        return json.dumps(payload)


class WebhookSubscriptionUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a new subscription is updated. This event fires if the subscription is cancelled, both immediately and if the subscription is cancelled at the end of the current period.

    **Discord & Slack support:** On cancellation
    """

    type: Literal[WebhookEventType.subscription_updated]
    data: SubscriptionSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        # Avoid to send notifications for subscription renewals (not interesting)
        # TODO: Notify about upgrades and downgrades
        if not self.data.cancel_at_period_end and not self.data.ended_at:
            raise SkipEvent(self.type, WebhookFormat.discord)

        price = self.data.price
        if price is None:
            price_display = "Free"
        else:
            price_display = price.get_display_price()

        if self.data.cancel_at_period_end:
            ends_at = format_date(self.data.current_period_end, locale="en_US")
        else:
            ends_at = format_date(self.data.ended_at, locale="en_US")

        fields: list[DiscordEmbedField] = [
            {"name": "Product", "value": self.data.product.name},
            {"name": "Price", "value": price_display},
            {"name": "Customer", "value": self.data.user.email},
            {"name": "Status", "value": self.data.status},
            {"name": "Ends At", "value": ends_at},
        ]
        payload: DiscordPayload = {
            "content": "Subscription has been cancelled.",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Cancelled Subscription",
                        "description": "Subscription has been cancelled.",
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        # Avoid to send notifications for subscription renewals (not interesting)
        # TODO: Notify about upgrades and downgrades
        if not self.data.cancel_at_period_end and not self.data.ended_at:
            raise SkipEvent(self.type, WebhookFormat.slack)

        price = self.data.price
        if price is None:
            price_display = "Free"
        else:
            price_display = price.get_display_price()

        if self.data.cancel_at_period_end:
            ends_at = format_date(self.data.current_period_end, locale="en_US")
        else:
            ends_at = format_date(self.data.ended_at, locale="en_US")

        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Product*\n{self.data.product.name}"},
            {"type": "mrkdwn", "text": f"*Price*\n{price_display}"},
            {"type": "mrkdwn", "text": f"*Customer*\n{self.data.user.email}"},
            {"type": "mrkdwn", "text": f"*Status*\n{self.data.status}"},
            {"type": "mrkdwn", "text": f"*Ends At*\n{ends_at}"},
        ]
        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "Subscription has been cancelled.",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Subscription has been cancelled.",
                        },
                        "fields": fields,
                    }
                ],
            }
        )

        return json.dumps(payload)


class WebhookProductCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new product is created.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.product_created]
    data: ProductSchema


class WebhookProductUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a product is updated.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.product_updated]
    data: ProductSchema


class WebhookPledgeCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new pledge is created. Note that this does mean that the pledge has been paid yet.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.pledge_created]
    data: PledgeSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        amount = self.data.amount / 100
        url = f"https://polar.sh/{target.slug}/{self.data.issue.repository.name}/issues/{self.data.issue.number}"
        fields: list[DiscordEmbedField] = [
            {"name": "Issue", "value": f"[{self.data.issue.title}]({url})"},
            {"name": "Amount", "value": f"${amount}"},
        ]
        payload: DiscordPayload = {
            "content": "New Donation Received",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "New Pledge Received",
                        "description": f"A ${amount} pledge has been made towards {self.data.issue.repository.name}#{self.data.issue.number}",
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        amount = self.data.amount / 100
        url = f"https://polar.sh/{target.slug}/{self.data.issue.repository.name}/issues/{self.data.issue.number}"
        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Issue*\n<{url}|{self.data.issue.title}>"},
            {"type": "mrkdwn", "text": f"*Amount*\n${amount}"},
        ]
        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "New Pledge Received",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"A ${amount} pledge has been made towards {self.data.issue.repository.name}#{self.data.issue.number}",
                        },
                        "fields": fields,
                    }
                ],
            }
        )

        return json.dumps(payload)


class WebhookPledgeUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a pledge is updated.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.pledge_updated]
    data: PledgeSchema


class WebhookDonationCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new donation is created.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.donation_created]
    data: DonationSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        amount = self.data.amount / 100
        fields: list[DiscordEmbedField] = []
        if self.data.donor:
            fields.append({"name": "Donor", "value": self.data.donor.get_name()})
        fields.append({"name": "Amount", "value": f"${amount}"})
        if self.data.message:
            fields.append({"name": "Message", "value": self.data.message})
        payload: DiscordPayload = {
            "content": "New Donation Received",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "New Donation Received",
                        "description": f"A ${amount} donation has been made to {target.name}",
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        amount = self.data.amount / 100
        fields: list[SlackText] = []
        if self.data.donor:
            fields.append(
                {"type": "mrkdwn", "text": f"*Donor*\n{self.data.donor.get_name()}"}
            )
        fields.append({"type": "mrkdwn", "text": f"*Amount*\n${amount}"})
        if self.data.message:
            fields.append({"type": "mrkdwn", "text": f"*Message*\n{self.data.message}"})

        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "New Donation Received",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"A ${amount} donation has been made to {target.name}",
                        },
                        "fields": fields,
                    }
                ],
            }
        )

        return json.dumps(payload)


class WebhookOrganizationUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a organization is updated.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.organization_updated]
    data: OrganizationSchema


class WebhookBenefitCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new benefit is created.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.benefit_created]
    data: BenefitSchema


class WebhookBenefitUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a benefit is updated.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.benefit_updated]
    data: BenefitSchema


WebhookPayload = Annotated[
    WebhookOrderCreatedPayload
    | WebhookSubscriptionCreatedPayload
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
