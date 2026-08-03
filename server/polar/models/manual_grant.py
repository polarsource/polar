from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, Uuid, text
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Customer
    from polar.models.benefit_grant import BenefitGrant


class ManualGrant(RecordModel):
    """
    One act of manually granting benefits to a customer, independent of any
    subscription or order. It is the third owner scope of `BenefitGrant`,
    fanning out to many grants the same way `subscription_id`/`order_id` do.

    A manual grant is the unit of intent: all grants created by it share one
    `reason` and one `expires_at`. Per-benefit expiration means separate
    manual grants. Revocation, in contrast, is per child grant.
    """

    __tablename__ = "manual_grants"
    __table_args__ = (
        Index(
            "ix_manual_grants_pending_expiration",
            "expires_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    reason: Mapped[str | None] = mapped_column(nullable=True)

    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    @declared_attr
    def grants(cls) -> Mapped[list["BenefitGrant"]]:
        return relationship(
            "BenefitGrant",
            lazy="raise",
            viewonly=True,
            order_by="BenefitGrant.created_at.asc()",
            primaryjoin=(
                "and_("
                "ManualGrant.id == BenefitGrant.manual_grant_id, "
                "BenefitGrant.deleted_at.is_(None)"
                ")"
            ),
            foreign_keys="BenefitGrant.manual_grant_id",
        )
