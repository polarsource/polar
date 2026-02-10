from typing import TypedDict


class TinybirdEvent(TypedDict):
    id: str
    ingested_at: str
    timestamp: str
    name: str
    source: str
    organization_id: str
    customer_id: str | None
    external_customer_id: str | None
    member_id: str | None
    external_member_id: str | None
    external_id: str | None
    parent_id: str | None
    root_id: str | None
    event_type_id: str | None
    # Meter fields
    meter_id: str | None
    units: int | None
    rollover: bool | None
    # Core entity IDs
    product_id: str | None
    subscription_id: str | None
    order_id: str | None
    order_created_at: str | None
    benefit_id: str | None
    benefit_grant_id: str | None
    checkout_id: str | None
    transaction_id: str | None
    refund_id: str | None
    dispute_id: str | None
    discount_id: str | None
    # Financial fields
    amount: int | None
    currency: str | None
    net_amount: int | None
    tax_amount: int | None
    discount_amount: int | None
    applied_balance_amount: int | None
    platform_fee: int | None
    fee: int | None
    refunded_amount: int | None
    refundable_amount: int | None
    presentment_amount: int | None
    presentment_currency: str | None
    # Subscription fields
    recurring_interval: str | None
    recurring_interval_count: int | None
    old_product_id: str | None
    new_product_id: str | None
    old_seats: int | None
    new_seats: int | None
    started_at: str | None
    canceled_at: str | None
    ends_at: str | None
    old_period_end: str | None
    new_period_end: str | None
    cancel_at_period_end: bool | None
    customer_cancellation_reason: str | None
    customer_cancellation_comment: str | None
    proration_behavior: str | None
    # Type/enum fields
    benefit_type: str | None
    billing_type: str | None
    checkout_status: str | None
    # Customer fields
    customer_email: str | None
    customer_name: str | None
    # Tax fields
    tax_state: str | None
    tax_country: str | None
    # User event fields (_cost, _llm)
    cost_amount: int | None
    cost_currency: str | None
    llm_vendor: str | None
    llm_model: str | None
    llm_input_tokens: int | None
    llm_output_tokens: int | None
    # Remaining metadata as JSON string
    user_metadata: str
