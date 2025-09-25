import inspect
import json
import typing
from datetime import datetime
from inspect import Parameter, Signature
from typing import Annotated, Any, Literal, assert_never, get_args, get_origin

from babel.dates import format_date
from fastapi import FastAPI
from fastapi.routing import APIRoute
from makefun import with_signature
from pydantic import (
    Discriminator,
    GetJsonSchemaHandler,
    TypeAdapter,
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema as cs

from polar.benefit.schemas import Benefit as BenefitSchema
from polar.benefit.schemas import BenefitGrantWebhook
from polar.checkout.schemas import Checkout as CheckoutSchema
from polar.customer.schemas.customer import Customer as CustomerSchema
from polar.customer.schemas.state import CustomerState as CustomerStateSchema
from polar.exceptions import PolarError
from polar.integrations.discord.webhook import (
    DiscordEmbedField,
    DiscordPayload,
    get_branded_discord_embed,
)
from polar.kit.schemas import IDSchema, Schema
from polar.models import (
    Benefit,
    BenefitGrant,
    Checkout,
    Customer,
    Order,
    Organization,
    Product,
    Refund,
    Subscription,
    User,
)
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.order.schemas import Order as OrderSchema
from polar.organization.schemas import Organization as OrganizationSchema
from polar.product.schemas import Product as ProductSchema
from polar.refund.schemas import Refund as RefundSchema
from polar.subscription.schemas import Subscription as SubscriptionSchema

from .slack import SlackPayload, SlackText, get_branded_slack_payload

WebhookTypeObject = (
    tuple[Literal[WebhookEventType.checkout_created], Checkout]
    | tuple[Literal[WebhookEventType.checkout_updated], Checkout]
    | tuple[Literal[WebhookEventType.customer_created], Customer]
    | tuple[Literal[WebhookEventType.customer_updated], Customer]
    | tuple[Literal[WebhookEventType.customer_deleted], Customer]
    | tuple[Literal[WebhookEventType.customer_state_changed], CustomerStateSchema]
    | tuple[Literal[WebhookEventType.order_created], Order]
    | tuple[Literal[WebhookEventType.order_updated], Order]
    | tuple[Literal[WebhookEventType.order_paid], Order]
    | tuple[Literal[WebhookEventType.order_refunded], Order]
    | tuple[Literal[WebhookEventType.subscription_created], Subscription]
    | tuple[Literal[WebhookEventType.subscription_updated], Subscription]
    | tuple[Literal[WebhookEventType.subscription_active], Subscription]
    | tuple[Literal[WebhookEventType.subscription_canceled], Subscription]
    | tuple[Literal[WebhookEventType.subscription_revoked], Subscription]
    | tuple[Literal[WebhookEventType.subscription_uncanceled], Subscription]
    | tuple[Literal[WebhookEventType.refund_created], Refund]
    | tuple[Literal[WebhookEventType.refund_updated], Refund]
    | tuple[Literal[WebhookEventType.product_created], Product]
    | tuple[Literal[WebhookEventType.product_updated], Product]
    | tuple[Literal[WebhookEventType.organization_updated], Organization]
    | tuple[Literal[WebhookEventType.benefit_created], Benefit]
    | tuple[Literal[WebhookEventType.benefit_updated], Benefit]
    | tuple[Literal[WebhookEventType.benefit_grant_created], BenefitGrant]
    | tuple[Literal[WebhookEventType.benefit_grant_updated], BenefitGrant]
    | tuple[Literal[WebhookEventType.benefit_grant_cycled], BenefitGrant]
    | tuple[Literal[WebhookEventType.benefit_grant_revoked], BenefitGrant]
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
    timestamp: datetime
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

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: cs.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        json_schema = handler(core_schema)
        json_schema = handler.resolve_ref_schema(json_schema)

        # Force the example of the `type` field to be the event type literal value
        type_field_annotation = cls.model_fields["type"].annotation
        if get_origin(type_field_annotation) is Literal:
            literal_value = get_args(type_field_annotation)[0]
            json_schema["properties"]["type"]["examples"] = [literal_value]

        return json_schema


class WebhookCheckoutCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new checkout is created.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.checkout_created]
    data: CheckoutSchema


class WebhookCheckoutUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a checkout is updated.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.checkout_updated]
    data: CheckoutSchema


class WebhookCustomerCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new customer is created.

    A customer can be created:

    * After a successful checkout.
    * Programmatically via the API.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.customer_created]
    data: CustomerSchema


class WebhookCustomerUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a customer is updated.

    This event is fired when the customer details are updated.

    If you want to be notified when a customer subscription or benefit state changes, you should listen to the `customer_state_changed` event.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.customer_updated]
    data: CustomerSchema


class WebhookCustomerDeletedPayload(BaseWebhookPayload):
    """
    Sent when a customer is deleted.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.customer_deleted]
    data: CustomerSchema


class WebhookCustomerStateChangedPayload(BaseWebhookPayload):
    """
    Sent when a customer state has changed.

    It's triggered when:

    * Customer is created, updated or deleted.
    * A subscription is created or updated.
    * A benefit is granted or revoked.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.customer_state_changed]
    data: CustomerStateSchema


class WebhookOrderPayloadBase(BaseWebhookPayload):
    """
    Base class for order payloads.
    """

    type: (
        Literal[WebhookEventType.order_created]
        | Literal[WebhookEventType.order_updated]
        | Literal[WebhookEventType.order_paid]
    )
    data: OrderSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        amount_display = self.data.get_amount_display()

        fields: list[DiscordEmbedField] = [
            {"name": "Product", "value": self.data.product.name},
            {"name": "Amount", "value": amount_display},
            {"name": "Customer", "value": self.data.customer.email},
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

        amount_display = self.data.get_amount_display()

        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Product*\n{self.data.product.name}"},
            {"type": "mrkdwn", "text": f"*Amount*\n{amount_display}"},
            {"type": "mrkdwn", "text": f"*Customer*\n{self.data.customer.email}"},
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


class WebhookOrderCreatedPayload(WebhookOrderPayloadBase):
    """
    Sent when a new order is created.

    A new order is created when:

    * A customer purchases a one-time product. In this case, `billing_reason` is set to `purchase`.
    * A customer starts a subscription. In this case, `billing_reason` is set to `subscription_create`.
    * A subscription is renewed. In this case, `billing_reason` is set to `subscription_cycle`.
    * A subscription is upgraded or downgraded with an immediate proration invoice. In this case, `billing_reason` is set to `subscription_update`.

    <Warning>The order might not be paid yet, so the `status` field might be `pending`.</Warning>

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.order_created]


class WebhookOrderUpdatedPayload(WebhookOrderPayloadBase):
    """
    Sent when an order is updated.

    An order is updated when:

    * Its status changes, e.g. from `pending` to `paid`.
    * It's refunded, partially or fully.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.order_updated]


class WebhookOrderPaidPayload(WebhookOrderPayloadBase):
    """
    Sent when an order is paid.

    When you receive this event, the order is fully processed and payment has been received.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.order_paid]


class WebhookOrderRefundedPayload(BaseWebhookPayload):
    """
    Sent when an order is fully or partially refunded.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.order_refunded]
    data: OrderSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        amount_display = self.data.get_refunded_amount_display()

        fields: list[DiscordEmbedField] = [
            {"name": "Product", "value": self.data.product.name},
            {"name": "Refunded", "value": amount_display},
            {"name": "Customer", "value": self.data.customer.email},
        ]
        if self.data.subscription is not None:
            fields.append({"name": "Subscription", "value": "Yes"})

        if self.data.status == OrderStatus.refunded:
            fields.append({"name": "Fully Refunded", "value": "Yes"})

        payload: DiscordPayload = {
            "content": "Order Refunded",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Order Refunded",
                        "description": f"Order refunded for {target.name}.",
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        amount_display = self.data.get_refunded_amount_display()

        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Product*\n{self.data.product.name}"},
            {"type": "mrkdwn", "text": f"*Refunded*\n{amount_display}"},
            {"type": "mrkdwn", "text": f"*Customer*\n{self.data.customer.email}"},
        ]
        if self.data.subscription is not None:
            fields.append({"type": "mrkdwn", "text": "*Subscription*\nYes"})

        if self.data.status == OrderStatus.refunded:
            fields.append({"type": "mrkdwn", "text": "*Fully Refunded*\nYes"})

        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "Order Refunded",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"Order refunded for {target.name}.",
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

    When this event occurs, the subscription `status` might not be `active` yet, as we can still have to wait for the first payment to be processed.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.subscription_created]
    data: SubscriptionSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        amount_display = self.data.get_amount_display()

        fields: list[DiscordEmbedField] = [
            {"name": "Product", "value": self.data.product.name},
            {"name": "Amount", "value": amount_display},
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

        amount_display = self.data.get_amount_display()

        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Product*\n{self.data.product.name}"},
            {"type": "mrkdwn", "text": f"*Amount*\n{amount_display}"},
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


class WebhookSubscriptionUpdatedPayloadBase(BaseWebhookPayload):
    """
    Base class for subscription updated payloads.
    """

    type: (
        Literal[WebhookEventType.subscription_updated]
        | Literal[WebhookEventType.subscription_active]
        | Literal[WebhookEventType.subscription_canceled]
        | Literal[WebhookEventType.subscription_uncanceled]
        | Literal[WebhookEventType.subscription_revoked]
    )
    data: SubscriptionSchema

    def _get_active_discord_payload(self, target: User | Organization) -> str:
        fields = self._get_discord_fields(target)
        payload: DiscordPayload = {
            "content": "Subscription is now active.",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Active Subscription",
                        "description": "Subscription is now active.",
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def _get_active_slack_payload(self, target: User | Organization) -> str:
        fields = self._get_slack_fields(target)
        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "Subscription is now active.",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Subscription is now active.",
                        },
                        "fields": fields,
                    }
                ],
            }
        )

        return json.dumps(payload)

    def _get_canceled_discord_payload(self, target: User | Organization) -> str:
        fields = self._get_discord_fields(target)
        if self.data.ends_at:
            ends_at = format_date(self.data.ends_at, locale="en_US")
        else:
            ends_at = format_date(self.data.ended_at, locale="en_US")
        fields.append({"name": "Ends At", "value": ends_at})

        payload: DiscordPayload = {
            "content": "Subscription has been canceled.",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Canceled Subscription",
                        "description": "Subscription has been canceled.",
                        "fields": fields,
                    }
                )
            ],
        }

        return json.dumps(payload)

    def _get_canceled_slack_payload(self, target: User | Organization) -> str:
        fields = self._get_slack_fields(target)
        if self.data.ends_at:
            ends_at = format_date(self.data.ends_at, locale="en_US")
        else:
            ends_at = format_date(self.data.ended_at, locale="en_US")
        fields.append({"type": "mrkdwn", "text": f"*Ends At*\n{ends_at}"})

        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "Subscription has been canceled.",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Subscription has been canceled.",
                        },
                        "fields": fields,
                    }
                ],
            }
        )

        return json.dumps(payload)

    def _get_uncanceled_discord_payload(self, target: User | Organization) -> str:
        payload: DiscordPayload = {
            "content": "Subscription has been uncanceled.",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Uncanceled Subscription",
                        "description": "Subscription has been restored.",
                        "fields": self._get_discord_fields(target),
                    }
                )
            ],
        }

        return json.dumps(payload)

    def _get_uncanceled_slack_payload(self, target: User | Organization) -> str:
        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "Subscription has been uncanceled.",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Subscription has been restored.",
                        },
                        "fields": self._get_slack_fields(target),
                    }
                ],
            }
        )

        return json.dumps(payload)

    def _get_revoked_discord_payload(self, target: User | Organization) -> str:
        payload: DiscordPayload = {
            "content": "Subscription has been revoked.",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Revoked Subscription",
                        "description": "Subscription has been revoked.",
                        "fields": self._get_discord_fields(target),
                    }
                )
            ],
        }

        return json.dumps(payload)

    def _get_revoked_slack_payload(self, target: User | Organization) -> str:
        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "Subscription has been revoked.",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Subscription has been revoked.",
                        },
                        "fields": self._get_slack_fields(target),
                    }
                ],
            }
        )

        return json.dumps(payload)

    def _get_discord_fields(
        self, target: User | Organization
    ) -> list[DiscordEmbedField]:
        amount_display = self.data.get_amount_display()
        fields: list[DiscordEmbedField] = [
            {"name": "Product", "value": self.data.product.name},
            {"name": "Amount", "value": amount_display},
            {"name": "Customer", "value": self.data.user.email},
            {"name": "Status", "value": self.data.status},
        ]
        return fields

    def _get_slack_fields(self, target: User | Organization) -> list[SlackText]:
        amount_display = self.data.get_amount_display()
        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Product*\n{self.data.product.name}"},
            {"type": "mrkdwn", "text": f"*Amount*\n{amount_display}"},
            {"type": "mrkdwn", "text": f"*Customer*\n{self.data.user.email}"},
            {"type": "mrkdwn", "text": f"*Status*\n{self.data.status}"},
        ]
        return fields


class WebhookSubscriptionUpdatedPayload(WebhookSubscriptionUpdatedPayloadBase):
    """
    Sent when a subscription is updated. This event fires for all changes to the subscription, including renewals.

    If you want more specific events, you can listen to `subscription.active`, `subscription.canceled`, and `subscription.revoked`.

    To listen specifically for renewals, you can listen to `order.created` events and check the `billing_reason` field.

    **Discord & Slack support:** On cancellation and revocation. Renewals are skipped.
    """

    type: Literal[WebhookEventType.subscription_updated]
    data: SubscriptionSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        if SubscriptionStatus.is_revoked(self.data.status):
            return self._get_revoked_discord_payload(target)

        # Avoid to send notifications for subscription renewals (not interesting)
        # TODO: Notify about upgrades and downgrades
        if not self.data.ends_at and not self.data.ended_at:
            raise SkipEvent(self.type, WebhookFormat.discord)

        return self._get_canceled_discord_payload(target)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        if SubscriptionStatus.is_revoked(self.data.status):
            return self._get_revoked_discord_payload(target)

        # Avoid to send notifications for subscription renewals (not interesting)
        # TODO: Notify about upgrades and downgrades
        if not self.data.ends_at and not self.data.ended_at:
            raise SkipEvent(self.type, WebhookFormat.slack)

        return self._get_canceled_slack_payload(target)


class WebhookSubscriptionActivePayload(WebhookSubscriptionUpdatedPayloadBase):
    """
    Sent when a subscription becomes active,
    whether because it's a new paid subscription or because payment was recovered.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.subscription_active]
    data: SubscriptionSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        return self._get_active_discord_payload(target)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        return self._get_active_slack_payload(target)


class WebhookSubscriptionCanceledPayload(WebhookSubscriptionUpdatedPayloadBase):
    """
    Sent when a subscription is canceled.
    Customers might still have access until the end of the current period.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.subscription_canceled]
    data: SubscriptionSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        return self._get_canceled_discord_payload(target)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        return self._get_canceled_slack_payload(target)


class WebhookSubscriptionUncanceledPayload(WebhookSubscriptionUpdatedPayloadBase):
    """
    Sent when a subscription is uncanceled.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.subscription_uncanceled]
    data: SubscriptionSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        return self._get_uncanceled_discord_payload(target)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        return self._get_uncanceled_slack_payload(target)


class WebhookSubscriptionRevokedPayload(WebhookSubscriptionUpdatedPayloadBase):
    """
    Sent when a subscription is revoked, the user loses access immediately.
    Happens when the subscription is canceled, or payment is past due.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.subscription_revoked]
    data: SubscriptionSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        return self._get_revoked_discord_payload(target)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        return self._get_revoked_slack_payload(target)


class WebhookRefundBase(BaseWebhookPayload):
    """
    Base Refund
    """

    type: (
        Literal[WebhookEventType.refund_created]
        | Literal[WebhookEventType.refund_updated]
    )
    data: RefundSchema

    def _get_discord_fields(
        self, target: User | Organization
    ) -> list[DiscordEmbedField]:
        amount_display = self.data.get_amount_display()
        fields: list[DiscordEmbedField] = [
            {"name": "Amount", "value": amount_display},
            {"name": "Status", "value": self.data.status},
        ]
        return fields

    def _get_slack_fields(self, target: User | Organization) -> list[SlackText]:
        amount_display = self.data.get_amount_display()
        fields: list[SlackText] = [
            {"type": "mrkdwn", "text": f"*Amount*\n{amount_display}"},
            {"type": "mrkdwn", "text": f"*Status*\n{self.data.status}"},
        ]
        return fields


class WebhookRefundCreatedPayload(WebhookRefundBase):
    """
    Sent when a refund is created regardless of status.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.refund_created]
    data: RefundSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        payload: DiscordPayload = {
            "content": "Refund Created",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Refund Created",
                        "description": f"Refund has been created for {target.name}.",
                        "fields": self._get_discord_fields(target),
                    }
                )
            ],
        }
        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "Refund Created",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"Refund has been created for {target.name}.",
                        },
                        "fields": self._get_slack_fields(target),
                    }
                ],
            }
        )
        return json.dumps(payload)


class WebhookRefundUpdatedPayload(WebhookRefundBase):
    """
    Sent when a refund is updated.

    **Discord & Slack support:** Full
    """

    type: Literal[WebhookEventType.refund_updated]
    data: RefundSchema

    def get_discord_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.discord)

        payload: DiscordPayload = {
            "content": "Refund Updated",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Refund Updated",
                        "description": f"Refund has been updated for {target.name}.",
                        "fields": self._get_discord_fields(target),
                    }
                )
            ],
        }
        return json.dumps(payload)

    def get_slack_payload(self, target: User | Organization) -> str:
        if isinstance(target, User):
            raise UnsupportedTarget(target, self.__class__, WebhookFormat.slack)

        payload: SlackPayload = get_branded_slack_payload(
            {
                "text": "Refund Updated",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"Refund has been updated for {target.name}.",
                        },
                        "fields": self._get_slack_fields(target),
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


class WebhookBenefitGrantCreatedPayload(BaseWebhookPayload):
    """
    Sent when a new benefit grant is created.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.benefit_grant_created]
    data: BenefitGrantWebhook


class WebhookBenefitGrantUpdatedPayload(BaseWebhookPayload):
    """
    Sent when a benefit grant is updated.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.benefit_grant_updated]
    data: BenefitGrantWebhook


class WebhookBenefitGrantCycledPayload(BaseWebhookPayload):
    """
    Sent when a benefit grant is cycled,
    meaning the related subscription has been renewed for another period.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.benefit_grant_cycled]
    data: BenefitGrantWebhook


class WebhookBenefitGrantRevokedPayload(BaseWebhookPayload):
    """
    Sent when a benefit grant is revoked.

    **Discord & Slack support:** Basic
    """

    type: Literal[WebhookEventType.benefit_grant_revoked]
    data: BenefitGrantWebhook


WebhookPayload = Annotated[
    WebhookCheckoutCreatedPayload
    | WebhookCheckoutUpdatedPayload
    | WebhookCustomerCreatedPayload
    | WebhookCustomerUpdatedPayload
    | WebhookCustomerDeletedPayload
    | WebhookCustomerStateChangedPayload
    | WebhookOrderCreatedPayload
    | WebhookOrderUpdatedPayload
    | WebhookOrderPaidPayload
    | WebhookOrderRefundedPayload
    | WebhookSubscriptionCreatedPayload
    | WebhookSubscriptionUpdatedPayload
    | WebhookSubscriptionActivePayload
    | WebhookSubscriptionCanceledPayload
    | WebhookSubscriptionUncanceledPayload
    | WebhookSubscriptionRevokedPayload
    | WebhookRefundCreatedPayload
    | WebhookRefundUpdatedPayload
    | WebhookProductCreatedPayload
    | WebhookProductUpdatedPayload
    | WebhookOrganizationUpdatedPayload
    | WebhookBenefitCreatedPayload
    | WebhookBenefitUpdatedPayload
    | WebhookBenefitGrantCreatedPayload
    | WebhookBenefitGrantUpdatedPayload
    | WebhookBenefitGrantCycledPayload
    | WebhookBenefitGrantRevokedPayload,
    Discriminator(discriminator="type"),
]
WebhookPayloadTypeAdapter: TypeAdapter[WebhookPayload] = TypeAdapter(WebhookPayload)


class WebhookAPIRoute(APIRoute):
    """
    Since FastAPI documents webhook through API routes with a body field,
    we might be in a situation where it generates `-Input` and `-Output` variants
    of the schemas because it sees them as "input" schemas.

    But we don't want that.

    The trick here is to force the body field to be in "serialization" mode, so we
    prevent Pydantic to generate the `-Input` and `-Output` variants.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        if self.body_field is not None:
            self.body_field.mode = "serialization"


def document_webhooks(app: FastAPI) -> None:
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
            route_class_override=WebhookAPIRoute,
        )
