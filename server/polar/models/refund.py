from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    ColumnElement,
    ForeignKey,
    Integer,
    String,
    Uuid,
    type_coerce,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import (
        Customer,
        Order,
        Organization,
        Pledge,
        Subscription,
    )


class RefundStatus(StrEnum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    canceled = "canceled"


# Decoupled from Stripe
# 1) Allowing more reasons (good signals)
# 2) Allowing us to enable merchants to set `fraudulent` without automatically
#    tagging it as such on Stripe.
class RefundReason(StrEnum):
    duplicate = "duplicate"
    fraudulent = "fraudulent"
    customer_request = "customer_request"
    service_disruption = "service_disruption"
    satisfaction_guarantee = "satisfaction_guarantee"
    other = "other"

    @classmethod
    def from_stripe(
        cls,
        reason: (
            Literal[
                "duplicate",
                "expired_uncaptured_charge",
                "fraudulent",
                "requested_by_customer",
            ]
            | None
        ),
    ) -> "RefundReason":
        if reason == "requested_by_customer":
            return cls.customer_request
        elif reason == "fraudulent":
            return cls.fraudulent
        elif reason == "duplicate":
            return cls.duplicate
        return cls.other

    @classmethod
    def to_stripe(
        cls, reason: "RefundReason"
    ) -> Literal["requested_by_customer", "duplicate"]:
        if reason == cls.duplicate:
            return "duplicate"

        # Avoid directly setting fraudulent since that blocks customers and can
        # be abused, i.e we should monitor our own fraudulent status and set it
        # retroactively on Stripe.
        return "requested_by_customer"


class RefundFailureReason(StrEnum):
    unknown = "unknown"
    declined = "declined"
    card_expired = "card_expired"
    card_lost = "card_lost"
    disputed = "disputed"
    insufficient_funds = "insufficient_funds"
    merchant_request = "merchant_request"

    @classmethod
    def from_stripe(
        cls,
        reason: (
            Literal[
                "lost_or_stolen_card",
                "expired_or_canceled_card",
                "charge_for_pending_refund_disputed",
                "insufficient_funds",
                "merchant_request",
                "unknown",
            ]
            | None
        ),
    ) -> "RefundFailureReason | None":
        if reason is None:
            return None

        if reason == "lost_or_stolen_card":
            return cls.card_lost
        elif reason == "expired_or_canceled_card":
            return cls.card_expired
        elif reason == "charge_for_pending_refund_disputed":
            return cls.disputed
        elif reason == "insufficient_funds":
            return cls.insufficient_funds
        elif reason == "merchant_request":
            return cls.merchant_request
        return cls.unknown


class Refund(MetadataMixin, RecordModel):
    __tablename__ = "refunds"

    status: Mapped[RefundStatus] = mapped_column(String, nullable=False)
    reason: Mapped[RefundReason] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    comment: Mapped[str | None] = mapped_column(String, nullable=True)

    failure_reason: Mapped[RefundFailureReason | None] = mapped_column(
        String, nullable=True
    )

    destination_details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    order_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("orders.id"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def order(cls) -> Mapped["Order"]:
        return relationship("Order", lazy="raise")

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise")

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    pledge_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("pledges.id"),
        nullable=True,
    )

    @declared_attr
    def pledge(cls) -> Mapped["Pledge"]:
        return relationship("Pledge", lazy="raise")

    # Created refund was set to revoke customer benefits?
    revoke_benefits: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    processor: Mapped[PaymentProcessor] = mapped_column(
        String,
        nullable=False,
    )
    processor_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
        unique=True,
        index=True,
    )
    processor_reason: Mapped[str] = mapped_column(String, nullable=False)
    processor_receipt_number: Mapped[str | None] = mapped_column(String, nullable=True)
    processor_balance_transaction_id: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    @hybrid_property
    def succeeded(self) -> bool:
        return self.status == RefundStatus.succeeded

    @succeeded.inplace.expression
    @classmethod
    def _succeeded_expression(cls) -> ColumnElement[bool]:
        return type_coerce(
            cls.status.in_(RefundStatus.succeeded),
            Boolean,
        )
