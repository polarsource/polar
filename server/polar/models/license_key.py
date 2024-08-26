from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.utils import utc_now

from .benefit import Benefit
from .user import User

if TYPE_CHECKING:
    from .license_key_activation import LicenseKeyActivation
    from .organization import Organization


class LicenseKeyStatus(StrEnum):
    granted = "granted"
    revoked = "revoked"
    disabled = "disabled"


class LicenseKey(RecordModel):
    __tablename__ = "license_keys"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship("User", lazy="raise")

    benefit_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("benefits.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def benefit(cls) -> Mapped[Benefit]:
        return relationship("Benefit", lazy="raise")

    key: Mapped[str] = mapped_column(String, nullable=False)

    status: Mapped[LicenseKeyStatus] = mapped_column(
        String, nullable=False, default=LicenseKeyStatus.granted
    )

    limit_activations: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @declared_attr
    def activations(cls) -> Mapped[list["LicenseKeyActivation"]]:
        return relationship(
            "LicenseKeyActivation", lazy="raise", back_populates="license_key"
        )

    usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    limit_usage: Mapped[int | None] = mapped_column(Integer, nullable=True)

    validations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    last_validated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    @property
    def display_key(self) -> str:
        prefix = "****"
        last_six_digits = self.key[-6:]
        return f"{prefix}-{last_six_digits}"

    def mark_revoked(self) -> None:
        self.status = LicenseKeyStatus.revoked

    def mark_validated(self, increment_usage: int | None = None) -> None:
        self.validations += 1
        self.last_validated_at = utc_now()
        if increment_usage:
            self.usage += increment_usage

    def is_active(self) -> bool:
        return self.status == LicenseKeyStatus.granted
