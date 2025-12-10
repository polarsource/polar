from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, CheckConstraint, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.product.guard import is_metered_price

if TYPE_CHECKING:
    from .customer import Customer
    from .member import Member
    from .order import Order
    from .subscription import Subscription


class SeatStatus(StrEnum):
    pending = "pending"
    claimed = "claimed"
    revoked = "revoked"


class CustomerSeat(RecordModel):
    """
    Represents a seat that can be assigned to a customer for access to benefits. It's
    mainly used for the seat-based billing.

    Seats can be associated with either:
    - A recurring subscription (subscription_id) for ongoing seat-based billing
    - A one-time order (order_id) for perpetual seat-based purchases

    Lifecycle:
    1. pending: Seat created but not yet assigned/claimed by an end customer
    2. claimed: Customer has accepted the invitation and benefits are granted
    3. revoked: Seat has been revoked, benefits removed, can be reassigned

    Key constraints:
    - Exactly one of subscription_id OR order_id must be set (enforced by seat_source_check)
    - For subscriptions: seats are tied to billing cycle, revoked when subscription ends
    - For orders: seats are perpetual, never expire once claimed
    """

    __tablename__ = "customer_seats"
    __table_args__ = (
        CheckConstraint(
            "(subscription_id IS NOT NULL AND order_id IS NULL) OR "
            "(subscription_id IS NULL AND order_id IS NOT NULL)",
            name="seat_source_check",
        ),
    )

    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    order_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("orders.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    status: Mapped[SeatStatus] = mapped_column(
        String, nullable=False, default=SeatStatus.pending
    )

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    member_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("members.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    invitation_token: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, index=True
    )

    invitation_token_expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    claimed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    seat_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata", JSONB, nullable=True, default=None
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise")

    @declared_attr
    def order(cls) -> Mapped["Order | None"]:
        return relationship("Order", lazy="raise")

    @declared_attr
    def customer(cls) -> Mapped["Customer | None"]:
        return relationship("Customer", lazy="raise")

    @declared_attr
    def member(cls) -> Mapped["Member | None"]:
        return relationship("Member", lazy="raise")

    def is_pending(self) -> bool:
        return self.status == SeatStatus.pending

    def is_claimed(self) -> bool:
        return self.status == SeatStatus.claimed

    def is_revoked(self) -> bool:
        return self.status == SeatStatus.revoked

    def has_metered_pricing(self) -> bool:
        if not self.subscription:
            return False

        return any(
            is_metered_price(spp.product_price)
            for spp in self.subscription.subscription_product_prices
        )
