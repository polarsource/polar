import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, ForeignKey, ForeignKeyConstraint, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

from .void_billing_identity import VoidBillingIdentity
from .void_product import VoidProduct

if TYPE_CHECKING:
    from .organization import Organization


class VoidSubscriptionStatus(StrEnum):
    active = "active"
    """Running; a `canceled` one still counts as active until `ends_at`."""
    canceled = "canceled"
    """Cancel requested; access lasts until `ends_at`."""
    revoked = "revoked"
    """Ended immediately at `ends_at`."""


class VoidSubscription(RecordModel):
    """A rebuildable projection of lifecycle events, pinned to a product generation."""

    __tablename__ = "void_subscriptions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "product_id"],
            ["void_products.organization_id", "void_products.id"],
        ),
        ForeignKeyConstraint(
            ["organization_id", "billing_identity_id"],
            ["void_billing_identities.organization_id", "void_billing_identities.id"],
        ),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    billing_identity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    canceled_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    """When access stops: the boundary after a cancel, or the revoke moment."""
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    product: Mapped[VoidProduct] = relationship(
        VoidProduct, foreign_keys=[product_id], lazy="raise"
    )
    billing_identity: Mapped[VoidBillingIdentity] = relationship(
        VoidBillingIdentity, foreign_keys=[billing_identity_id], lazy="raise"
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")

    def active_at(self, at: datetime) -> bool:
        if at < self.started_at:
            return False
        return self.ends_at is None or at < self.ends_at
