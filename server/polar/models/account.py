from uuid import UUID
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID, StringEnum

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.organization import Organization


class Account(RecordModel):
    class Status(str, Enum):
        CREATED = "created"
        ONBOARDING_STARTED = "onboarding_started"

    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("organization_id"),
        UniqueConstraint("stripe_id"),
    )

    account_type: Mapped[str] = mapped_column(String(10), nullable=False)

    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), unique=True
    )
    admin_id: Mapped[UUID] = mapped_column(PostgresUUID, ForeignKey("users.id"))

    stripe_id: Mapped[str] = mapped_column(String(100), nullable=False)

    email: Mapped[str | None] = mapped_column(String(254), nullable=True)

    country: Mapped[str | None] = mapped_column(String(2))
    currency: Mapped[str | None] = mapped_column(String(3))

    is_details_submitted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_charges_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_payouts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)

    business_type: Mapped[str] = mapped_column(String(10), nullable=True)

    status: Mapped[str] = mapped_column(
        StringEnum(Status), nullable=False, default=Status.CREATED
    )

    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    organization: "Mapped[Organization]" = relationship(
        "Organization", back_populates="account"
    )

    __mutables__ = {
        is_details_submitted,
        is_charges_enabled,
        is_payouts_enabled,
        type,
        data,
        status,
    }
