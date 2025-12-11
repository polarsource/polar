from enum import StrEnum
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.models.customer import Customer


class MemberRole(StrEnum):
    owner = "owner"
    billing_manager = "billing_manager"
    member = "member"


class Member(RecordModel):
    __tablename__ = "members"
    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            "email",
            name="members_customer_id_email_key",
            postgresql_nulls_not_distinct=True,
        ),
        UniqueConstraint(
            "customer_id",
            "external_id",
            name="members_customer_id_external_id_key",
            postgresql_nulls_not_distinct=False,
        ),
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="restrict"),
        nullable=False,
        index=True,
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="restrict"),
        nullable=False,
        index=True,
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    external_id: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    role: Mapped[MemberRole] = mapped_column(
        String, nullable=False, default=MemberRole.member
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise", back_populates="members")
