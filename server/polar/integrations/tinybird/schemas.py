from typing import Any, TypedDict


class TinybirdEvent(TypedDict):
    id: str
    ingested_at: str
    timestamp: str
    name: str
    source: str
    organization_id: str
    customer_id: str | None
    external_customer_id: str | None
    external_id: str | None
    parent_id: str | None
    root_id: str | None
    event_type_id: str | None
    meter_id: str | None
    units: int | None
    product_id: str | None
    subscription_id: str | None
    order_id: str | None
    amount: int | None
    currency: str | None
    user_metadata: dict[str, Any]
