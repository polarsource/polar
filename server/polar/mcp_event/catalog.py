from typing import Any, NamedTuple

from pydantic import TypeAdapter

from polar.customer.schemas.customer import CustomerResponse
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.schemas import Order
from polar.subscription.schemas import Subscription


def _trim(node: Any, defs: dict[str, Any], expanding: frozenset[str]) -> Any:
    if isinstance(node, list):
        return [_trim(item, defs, expanding) for item in node]
    if not isinstance(node, dict):
        return node
    if "$ref" in node:
        name = node["$ref"].rsplit("/", 1)[-1]
        definition = defs.get(name, {})
        if "properties" in definition or name in expanding:
            target = {"type": "object", "title": name}
        else:
            target = _trim(definition, defs, expanding | {name})
        siblings = {key: value for key, value in node.items() if key != "$ref"}
        return {**target, **_trim(siblings, defs, expanding)}
    trimmed = {
        key: _trim(value, defs, expanding)
        for key, value in node.items()
        if key != "$defs"
    }
    if isinstance(trimmed.get("discriminator"), dict):
        trimmed["discriminator"] = {
            key: value
            for key, value in trimmed["discriminator"].items()
            if key != "mapping"
        }
    return trimmed


def _inline(node: dict[str, Any], defs: dict[str, Any]) -> dict[str, Any]:
    if "$ref" not in node:
        return node
    definition = defs[node["$ref"].rsplit("/", 1)[-1]]
    return {**definition, **{k: v for k, v in node.items() if k != "$ref"}}


class MCPEventDefinition(NamedTuple):
    description: str
    data: TypeAdapter[Any]

    def payload_schema(self) -> dict[str, Any]:
        """The payload's top-level fields, with nested models reduced to their
        type and title. Enums and unions stay inline, and each variant of a
        top-level union keeps its own fields. The full schemas add up to
        ~900 KB across the catalog, more than MCP clients accept in
        `events/list`."""
        schema = self.data.json_schema(mode="serialization")
        defs = schema.get("$defs", {})
        for key in ("oneOf", "anyOf"):
            if key in schema:
                schema[key] = [_inline(variant, defs) for variant in schema[key]]
        return _trim(schema, defs, frozenset())


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
