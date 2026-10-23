from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import SubscriptionProrationBehavior
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models import Organization, Product


class SubscriptionBulkUpdate(RecordModel):
    __tablename__ = "subscription_bulk_updates"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    source_external_id: Mapped[str] = mapped_column(String, nullable=False)
    target_product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="restrict"),
        nullable=False,
        index=True,
    )
    proration_behavior: Mapped[SubscriptionProrationBehavior] = mapped_column(
        StringEnum(SubscriptionProrationBehavior), nullable=False
    )
    subscriptions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid, nullable=True, default=None
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def target_product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")
