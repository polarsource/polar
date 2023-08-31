from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.enums import AccountType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID, StringEnum
from polar.models.organization import Organization


class Account(RecordModel):
    class Status(str, Enum):
        CREATED = "created"
        ONBOARDING_STARTED = "onboarding_started"

    __tablename__ = "accounts"

    account_type: Mapped[AccountType] = mapped_column(String(255), nullable=False)

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), unique=True, nullable=True
    )

    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), unique=True, nullable=True
    )

    admin_id: Mapped[UUID] = mapped_column(PostgresUUID, ForeignKey("users.id"))

    stripe_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    open_collective_slug: Mapped[str | None] = mapped_column(String(255), nullable=True)

    email: Mapped[str | None] = mapped_column(String(254), nullable=True)

    country: Mapped[str | None] = mapped_column(String(2))
    currency: Mapped[str | None] = mapped_column(String(3))

    is_details_submitted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_charges_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_payouts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)

    business_type: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status: Mapped[str] = mapped_column(
        StringEnum(Status), nullable=False, default=Status.CREATED
    )

    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    organization: Mapped[Organization | None] = relationship(
        "Organization", foreign_keys=[organization_id]
    )

    # TODO: This is never used. Remove once active_record.upsert() is gone
    __mutables__ = {
        "is_details_submitted",
        "is_charges_enabled",
        "is_payouts_enabled",
        "type",
        "data",
        "status",
    }
