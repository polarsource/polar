from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .customer import Customer
    from .organization import Organization


class EventActor(RecordModel):
    """
    EventActor consolidates customer/member identifiers into a single entity.

    Events link to event_actor_id instead of directly to customer_id or
    external_customer_id. This enables efficient single-indexed joins for queries
    instead of expensive OR conditions with subqueries.

    Benefits:
    - Single indexed join instead of OR conditions
    - Automatic backfill: when Customer is created for existing external_customer_id,
      add customer_id to EventActor - all events resolve automatically
    - Extensible for future multi-seat (member_id, external_member_id)
    """

    __tablename__ = "event_actors"
    __table_args__ = (
        # Partial unique indexes - only enforce uniqueness for non-null values
        # within the same organization
        Index(
            "ix_event_actors_org_customer_id",
            "organization_id",
            "customer_id",
            unique=True,
            postgresql_where="customer_id IS NOT NULL AND deleted_at IS NULL",
        ),
        Index(
            "ix_event_actors_org_external_customer_id",
            "organization_id",
            "external_customer_id",
            unique=True,
            postgresql_where="external_customer_id IS NOT NULL AND deleted_at IS NULL",
        ),
        Index(
            "ix_event_actors_org_member_id",
            "organization_id",
            "member_id",
            unique=True,
            postgresql_where="member_id IS NOT NULL AND deleted_at IS NULL",
        ),
        Index(
            "ix_event_actors_org_external_member_id",
            "organization_id",
            "external_member_id",
            unique=True,
            postgresql_where="external_member_id IS NOT NULL AND deleted_at IS NULL",
        ),
        CheckConstraint(
            "customer_id IS NOT NULL OR external_customer_id IS NOT NULL "
            "OR member_id IS NOT NULL OR external_member_id IS NOT NULL",
            name="event_actors_has_identifier",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    # Customer identifiers
    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer | None"]:
        return relationship("Customer", lazy="raise")

    external_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    # Member identifiers (for future multi-seat support)
    member_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        # FK added when members table supports this
        nullable=True,
        index=True,
    )

    external_member_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )
