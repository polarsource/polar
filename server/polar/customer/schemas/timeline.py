from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import UUID4, Field, field_serializer

from polar.kit.schemas import ClassName, Schema
from polar.models.order import OrderBillingReason, OrderBillingReasonInternal


class CustomerTimelineEntryType(StrEnum):
    order = "order"
    refund = "refund"
    subscription_started = "subscription_started"
    subscription_canceled = "subscription_canceled"


class OrderTimelineEntry(Schema):
    """An order (charge) event."""

    type: Literal[CustomerTimelineEntryType.order] = CustomerTimelineEntryType.order
    id: UUID4
    timestamp: datetime
    amount: int = Field(description="Total charged amount in cents.")
    currency: str
    billing_reason: OrderBillingReasonInternal
    product_name: str | None

    @field_serializer("billing_reason")
    def serialize_billing_reason(
        self, value: OrderBillingReasonInternal
    ) -> OrderBillingReason:
        if value in {
            OrderBillingReasonInternal.subscription_cycle_after_trial,
            OrderBillingReasonInternal.subscription_cancel,
        }:
            return OrderBillingReason.subscription_cycle
        return OrderBillingReason(value)


class RefundTimelineEntry(Schema):
    """A refund event."""

    type: Literal[CustomerTimelineEntryType.refund] = CustomerTimelineEntryType.refund
    id: UUID4
    timestamp: datetime
    amount: int = Field(description="Refunded amount in cents.")
    currency: str
    order_id: UUID4 | None = Field(None, description="ID of the related order.")


class SubscriptionStartedTimelineEntry(Schema):
    """A subscription activation event."""

    type: Literal[CustomerTimelineEntryType.subscription_started] = (
        CustomerTimelineEntryType.subscription_started
    )
    id: UUID4
    timestamp: datetime
    subscription_id: UUID4
    product_name: str | None


class SubscriptionCanceledTimelineEntry(Schema):
    """A subscription cancellation event."""

    type: Literal[CustomerTimelineEntryType.subscription_canceled] = (
        CustomerTimelineEntryType.subscription_canceled
    )
    id: UUID4
    timestamp: datetime
    subscription_id: UUID4
    product_name: str | None


CustomerTimelineEntry = Annotated[
    OrderTimelineEntry
    | RefundTimelineEntry
    | SubscriptionStartedTimelineEntry
    | SubscriptionCanceledTimelineEntry,
    Field(discriminator="type"),
    ClassName("CustomerTimelineEntry"),
]
