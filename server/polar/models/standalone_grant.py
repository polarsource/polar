from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, Uuid, text
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Customer, Organization, User
    from polar.models.benefit_grant import BenefitGrant


class StandaloneGrant(RecordModel):
    """
    A standalone grant of benefits to a customer, independent of any subscription
    or order. Mirrors how `subscription_id`/`order_id` scopes fan out to many
    grants. Can be used to batch-add grants to a customer.
    """

    __tablename__ = "standalone_grants"
    __table_args__ = (
        Index(
            "ix_standalone_grants_pending_expiration",
            "expires_at",
            postgresql_where=text(
                "revocation_requested_at IS NULL AND deleted_at IS NULL"
            ),
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

    created_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def created_by_user(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="raise")

    created_by_organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def created_by_organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    reason: Mapped[str | None] = mapped_column(nullable=True)

    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    revocation_requested_at: Mapped[datetime | None] = mapped_column(
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
                "StandaloneGrant.id == BenefitGrant.standalone_grant_id, "
                "BenefitGrant.deleted_at.is_(None)"
                ")"
            ),
            foreign_keys="BenefitGrant.standalone_grant_id",
        )
