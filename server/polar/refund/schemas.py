import inspect
from typing import Annotated

from babel.numbers import format_currency
from fastapi import Path
from pydantic import UUID4, Field

from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.refund import (
    RefundReason,
    RefundStatus,
)

RefundID = Annotated[UUID4, Path(description="The refund ID.")]


class Refund(MetadataOutputMixin, IDSchema, TimestampedSchema):
    status: RefundStatus
    reason: RefundReason
    amount: int
    tax_amount: int
    currency: str
    organization_id: UUID4
    order_id: UUID4
    subscription_id: UUID4 | None
    customer_id: UUID4
    revoke_benefits: bool

    def get_amount_display(self) -> str:
        return f"{format_currency(
            self.amount / 100,
            self.currency.upper(),
            locale="en_US",
        )}"


class RefundCreate(MetadataInputMixin, Schema):
    order_id: UUID4
    reason: RefundReason
    amount: int
    comment: str | None = Field(
        None,
        description="An internal comment about the refund.",
    )
    revoke_benefits: bool = Field(
        False,
        description=inspect.cleandoc(
            """
            Should this refund trigger the associated customer benefits to be revoked?

            **Note:**
            Only allowed in case the `order` is a one-time purchase.
            Subscriptions automatically revoke customer benefits once the
            subscription itself is revoked, i.e fully canceled.
            """
        ),
    )
