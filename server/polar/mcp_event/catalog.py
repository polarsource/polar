from typing import Any, NamedTuple

from pydantic import TypeAdapter

from polar.customer.schemas.customer import CustomerResponse
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.schemas import Order
from polar.subscription.schemas import Subscription


class MCPEventDefinition(NamedTuple):
    description: str
    data: TypeAdapter[Any]


_order = TypeAdapter(Order)
_subscription = TypeAdapter(Subscription)
_customer = TypeAdapter(CustomerResponse)


MCP_EVENTS: dict[WebhookEventType, MCPEventDefinition] = {
    WebhookEventType.order_created: MCPEventDefinition(
        "An order was created. It may not be paid yet.", _order
    ),
    WebhookEventType.order_paid: MCPEventDefinition("An order was paid.", _order),
    WebhookEventType.order_refunded: MCPEventDefinition(
        "An order was fully or partially refunded.", _order
    ),
    WebhookEventType.subscription_created: MCPEventDefinition(
        "A subscription was created.", _subscription
    ),
    WebhookEventType.subscription_active: MCPEventDefinition(
        "A subscription became active.", _subscription
    ),
    WebhookEventType.subscription_canceled: MCPEventDefinition(
        "A subscription was canceled.", _subscription
    ),
    WebhookEventType.subscription_uncanceled: MCPEventDefinition(
        "A pending subscription cancellation was revoked.", _subscription
    ),
    WebhookEventType.subscription_revoked: MCPEventDefinition(
        "A subscription was revoked and the customer lost access.",
        _subscription,
    ),
    WebhookEventType.subscription_paused: MCPEventDefinition(
        "A subscription was paused.", _subscription
    ),
    WebhookEventType.subscription_resumed: MCPEventDefinition(
        "A paused subscription was resumed.", _subscription
    ),
    WebhookEventType.subscription_past_due: MCPEventDefinition(
        "A subscription payment failed and the subscription is past due.",
        _subscription,
    ),
    WebhookEventType.customer_created: MCPEventDefinition(
        "A customer was created.", _customer
    ),
    WebhookEventType.customer_updated: MCPEventDefinition(
        "A customer was updated.", _customer
    ),
    WebhookEventType.customer_deleted: MCPEventDefinition(
        "A customer was deleted.", _customer
    ),
}
