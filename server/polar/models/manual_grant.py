from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Customer
    from polar.models.benefit_grant import BenefitGrant


class ManualGrant(RecordModel):
    """
    A manual, standalone grant of benefits to a customer, independent of any
    subscription or order. Goal is to mirror how `subscription_id`/`order_id`
    scopes fan out to many grants. Can be used to 'batch' add grants to customer.
    """

    __tablename__ = "manual_grants"

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    # Shared expiry for every grant in the batch. (For next version with cron job etc.)
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
