from typing import Annotated, NamedTuple

from pydantic import UUID4, BeforeValidator

from polar.enums import SubscriptionRecurringInterval
from polar.kit.schemas import Schema
from polar.models.customer import CustomerType
from polar.models.order import (
    OrderBillingReason,
    OrderBillingReasonInternal,
    OrderStatus,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType


class OrderEventData(Schema):
    id: UUID4
    status: OrderStatus
    billing_reason: Annotated[
        OrderBillingReason, BeforeValidator(OrderBillingReasonInternal.to_public)
    ]
    customer_id: UUID4
    product_id: UUID4 | None
    subscription_id: UUID4 | None
    total_amount: int
    refunded_amount: int
    currency: str


class SubscriptionEventData(Schema):
    id: UUID4
    status: SubscriptionStatus
    customer_id: UUID4
    product_id: UUID4
    amount: int
    currency: str
    recurring_interval: SubscriptionRecurringInterval
    cancel_at_period_end: bool


class CustomerEventData(Schema):
    id: UUID4
    external_id: str | None
    type: CustomerType


class MCPEventDefinition(NamedTuple):
    description: str
    data_schema: type[Schema]


MCP_EVENTS: dict[WebhookEventType, MCPEventDefinition] = {
    WebhookEventType.order_created: MCPEventDefinition(
        "An order was created. It may not be paid yet.", OrderEventData
    ),
    WebhookEventType.order_paid: MCPEventDefinition(
        "An order was paid.", OrderEventData
    ),
    WebhookEventType.order_refunded: MCPEventDefinition(
        "An order was fully or partially refunded.", OrderEventData
    ),
    WebhookEventType.subscription_created: MCPEventDefinition(
        "A subscription was created.", SubscriptionEventData
    ),
    WebhookEventType.subscription_active: MCPEventDefinition(
        "A subscription became active.", SubscriptionEventData
    ),
    WebhookEventType.subscription_canceled: MCPEventDefinition(
        "A subscription was canceled.", SubscriptionEventData
    ),
    WebhookEventType.subscription_uncanceled: MCPEventDefinition(
        "A pending subscription cancellation was revoked.", SubscriptionEventData
    ),
    WebhookEventType.subscription_revoked: MCPEventDefinition(
        "A subscription was revoked and the customer lost access.",
        SubscriptionEventData,
    ),
    WebhookEventType.subscription_paused: MCPEventDefinition(
        "A subscription was paused.", SubscriptionEventData
    ),
    WebhookEventType.subscription_resumed: MCPEventDefinition(
        "A paused subscription was resumed.", SubscriptionEventData
    ),
    WebhookEventType.subscription_past_due: MCPEventDefinition(
        "A subscription payment failed and the subscription is past due.",
        SubscriptionEventData,
    ),
    WebhookEventType.customer_created: MCPEventDefinition(
        "A customer was created.", CustomerEventData
    ),
    WebhookEventType.customer_updated: MCPEventDefinition(
        "A customer was updated.", CustomerEventData
    ),
    WebhookEventType.customer_deleted: MCPEventDefinition(
        "A customer was deleted.", CustomerEventData
    ),
}
