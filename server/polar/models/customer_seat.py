from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .customer import Customer
    from .subscription import Subscription


class SeatStatus(StrEnum):
    pending = "pending"
    claimed = "claimed"
    revoked = "revoked"


class CustomerSeat(RecordModel):
    __tablename__ = "customer_seats"

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=False,
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
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise")

    @declared_attr
    def customer(cls) -> Mapped["Customer | None"]:
        return relationship("Customer", lazy="raise")

    def is_pending(self) -> bool:
        return self.status == SeatStatus.pending

    def is_claimed(self) -> bool:
        return self.status == SeatStatus.claimed

    def is_revoked(self) -> bool:
        return self.status == SeatStatus.revoked
