from typing import Any, NamedTuple

from pydantic import TypeAdapter

from polar.customer.schemas.customer import CustomerResponse
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.schemas import Order
from polar.subscription.schemas import Subscription


def _collapse_refs(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, dict):
        if "$ref" in node:
            name = node["$ref"].rsplit("/", 1)[-1]
            return {"type": defs.get(name, {}).get("type", "object"), "title": name}
        return {
            key: _collapse_refs(value, defs)
            for key, value in node.items()
            if key != "$defs"
        }
    if isinstance(node, list):
        return [_collapse_refs(item, defs) for item in node]
    return node


class MCPEventDefinition(NamedTuple):
    description: str
    data: TypeAdapter[Any]

    def payload_schema(self) -> dict[str, Any]:
        """The payload's top-level fields, with nested models reduced to their
        type and title: the full schemas add up to ~900 KB across the catalog,
        more than MCP clients accept in `events/list`."""
        schema = self.data.json_schema(mode="serialization")
        return _collapse_refs(schema, schema.get("$defs", {}))


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
